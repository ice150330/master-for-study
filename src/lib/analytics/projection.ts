import type {
  AnalyticsActivityCategory,
  AnalyticsConceptInput,
  AnalyticsDay,
  AnalyticsEventInput,
  AnalyticsInterviewInput,
  AnalyticsMetric,
  AnalyticsPracticeInput,
  AnalyticsRange,
  AnalyticsReviewInput,
  AnalyticsWeakSkill,
} from './types';

export const ANALYTICS_MIN_SAMPLE = 3;

const LEARNING_ACTIONS = new Set([
  'session_created',
  'message_sent',
  'term_seen',
  'note_created',
  'note_updated',
  'resource_created',
  'resource_updated',
  'resource_status_changed',
  'resource_highlight_created',
]);

export function analyticsCategory(action: string): AnalyticsActivityCategory | null {
  if (LEARNING_ACTIONS.has(action)) return 'learning';
  if (action === 'practice_attempted' || action === 'interview_answered') return 'assessment';
  if (action === 'reviewed') return 'review';
  return null;
}

export function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildActivityTrend(
  events: AnalyticsEventInput[],
  rangeDays: AnalyticsRange,
  now = new Date(),
): AnalyticsDay[] {
  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (rangeDays - index - 1));
    return {
      date: localDateKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      learning: 0,
      assessment: 0,
      review: 0,
      hints: 0,
      total: 0,
    } satisfies AnalyticsDay;
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const event of events) {
    const point = byDate.get(localDateKey(event.createdAt));
    const category = analyticsCategory(event.action);
    if (!point || !category) continue;
    point[category] += 1;
    point.total += 1;
    if (event.action === 'practice_attempted') {
      point.hints += numericValue(event.context?.hintCount);
    }
  }
  return days;
}

export function buildAnalyticsMetrics(input: {
  events: AnalyticsEventInput[];
  practiceAttempts: AnalyticsPracticeInput[];
  interviewAttempts: AnalyticsInterviewInput[];
  reviewLogs: AnalyticsReviewInput[];
}): AnalyticsMetric[] {
  const assessed = input.practiceAttempts.length + input.interviewAttempts.length;
  const passed = input.practiceAttempts.filter((attempt) => attempt.status === 'success').length
    + input.interviewAttempts.filter((attempt) => attempt.correct).length;
  const retained = input.reviewLogs.filter((log) => log.rating !== 'again').length;
  const usedHints = input.practiceAttempts.filter((attempt) => attempt.hintCount > 0).length;
  const activityCount = input.events.filter((event) => analyticsCategory(event.action) === 'learning').length;

  return [
    {
      id: 'activity',
      label: '学习活动',
      value: `${activityCount} 次`,
      detail: '对话、概念、笔记与资料阅读的有效记录',
      sampleSize: activityCount,
      status: 'ready',
      source: 'LearningEvent · learning actions',
      href: '#activity-ledger',
    },
    rateMetric('assessment', '评测通过', passed, assessed, '练习与面试合并计算', 'PracticeAttempt + InterviewAttempt', '/interview'),
    rateMetric('retention', '复习保留', retained, input.reviewLogs.length, 'Hard / Good / Easy 计为取回', 'ReviewLog.rating', '/review'),
    rateMetric('hints', '提示依赖', usedHints, input.practiceAttempts.length, '至少使用一次提示的练习占比', 'PracticeAttempt.hintCount', '#activity-ledger'),
  ];
}

export function rankWeakSkills(input: {
  concepts: AnalyticsConceptInput[];
  practiceAttempts: AnalyticsPracticeInput[];
  interviewAttempts: AnalyticsInterviewInput[];
  reviewLogs: AnalyticsReviewInput[];
  now?: Date;
}): AnalyticsWeakSkill[] {
  const now = input.now ?? new Date();
  return input.concepts.map((concept) => {
    const practices = input.practiceAttempts.filter((attempt) => attempt.conceptId === concept.id);
    const interviews = input.interviewAttempts.filter((attempt) => attempt.termId === concept.id);
    const reviews = input.reviewLogs.filter((log) => log.termId === concept.id);
    const failures = practices.filter((attempt) => attempt.status === 'error').length;
    const hintRuns = practices.filter((attempt) => attempt.hintCount > 0).length;
    const interviewMisses = interviews.filter((attempt) => !attempt.correct).length;
    const reviewMisses = reviews.filter((log) => log.rating === 'again').length;
    const overdue = Boolean(concept.dueAt && concept.dueAt.getTime() <= now.getTime());
    const evidence: string[] = [];
    if (concept.state === 'relearning') evidence.push('当前处于重学状态');
    if (overdue) evidence.push('复习已经到期');
    if (failures) evidence.push(`${failures} 次练习未通过`);
    if (hintRuns) evidence.push(`${hintRuns} 次练习使用提示`);
    if (interviewMisses) evidence.push(`${interviewMisses} 次面试判断未通过`);
    if (reviewMisses) evidence.push(`${reviewMisses} 次主动回忆失败`);
    if (evidence.length === 0 && (concept.difficulty ?? 0) >= 7) evidence.push('FSRS 难度偏高');

    const priority = Math.round(
      (concept.state === 'relearning' ? 24 : 0)
      + (overdue ? 16 : 0)
      + Math.min(20, (concept.difficulty ?? 0) * 2)
      + Math.min(24, failures * 8)
      + Math.min(12, hintRuns * 4)
      + Math.min(24, interviewMisses * 8)
      + Math.min(16, reviewMisses * 8),
    );
    const shouldPractice = failures > 0 || hintRuns > 0 || interviewMisses > 0;
    return {
      conceptId: concept.id,
      name: concept.name,
      state: concept.state,
      priority,
      evidence: evidence.slice(0, 3),
      sampleSize: practices.length + interviews.length + reviews.length,
      href: `/?concept=${concept.id}`,
      actionHref: shouldPractice ? `/interview?concept=${concept.id}` : `/review?concept=${concept.id}`,
      actionLabel: shouldPractice ? '模拟测验' : '开始复习',
    } satisfies AnalyticsWeakSkill;
  }).filter((concept) => concept.priority > 0 && concept.evidence.length > 0)
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 5);
}

function rateMetric(
  id: AnalyticsMetric['id'],
  label: string,
  numerator: number,
  denominator: number,
  detail: string,
  source: string,
  href: string,
): AnalyticsMetric {
  const ready = denominator >= ANALYTICS_MIN_SAMPLE;
  return {
    id,
    label,
    value: ready ? `${Math.round((numerator / denominator) * 100)}%` : '不足以判断',
    detail: ready ? `${detail} · ${denominator} 次样本` : `仅 ${denominator} 次样本，至少需要 ${ANALYTICS_MIN_SAMPLE} 次`,
    sampleSize: denominator,
    status: ready ? 'ready' : 'insufficient',
    source,
    href,
  };
}

function numericValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}
