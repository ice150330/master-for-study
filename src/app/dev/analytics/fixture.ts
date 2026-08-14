import type {
  AnalyticsActivity,
  AnalyticsDay,
  AnalyticsRange,
  LearningAnalytics,
} from '@/lib/analytics/types';

type FixtureMode = 'normal' | 'empty' | 'small';

export function analyticsFixture(mode: FixtureMode, rangeDays: AnalyticsRange = 7): LearningAnalytics {
  const trend = buildTrend(rangeDays, mode);
  if (mode === 'empty') {
    return {
      rangeDays,
      generatedAt: '2026-08-15T10:00:00.000Z',
      today: { dueReviews: 0, overdueReviews: 0, estimatedMinutes: 0, completedActions: 0 },
      recommendation: {
        eyebrow: '当前没有积压',
        title: '从一个真实问题开始',
        description: '新的对话会逐步形成概念、练习、复习和可追溯的成长证据。',
        href: '/',
        actionLabel: '开始对话',
      },
      trend,
      metrics: [
        metric('activity', '学习活动', '0 次', '还没有有效学习记录', 0, 'ready', 'LearningEvent · learning actions', '#activity-ledger'),
        metric('assessment', '评测通过', '不足以判断', '仅 0 次样本，至少需要 3 次', 0, 'insufficient', 'PracticeAttempt + InterviewAttempt', '/practice'),
        metric('retention', '复习保留', '不足以判断', '仅 0 次样本，至少需要 3 次', 0, 'insufficient', 'ReviewLog.rating', '/review'),
        metric('hints', '提示依赖', '不足以判断', '仅 0 次样本，至少需要 3 次', 0, 'insufficient', 'PracticeAttempt.hintCount', '/practice'),
      ],
      weakSkills: [],
      progress: [],
      recentActivities: [],
    };
  }

  if (mode === 'small') {
    const activities = normalActivities().slice(0, 4);
    return {
      rangeDays,
      generatedAt: '2026-08-15T10:00:00.000Z',
      today: { dueReviews: 1, overdueReviews: 0, estimatedMinutes: 1, completedActions: 2 },
      recommendation: {
        eyebrow: '优先处理记忆负荷',
        title: '1 个概念已到复习时间',
        description: '当前数据很少，先完成主动回忆，再等待更多评测证据。',
        href: '/review',
        actionLabel: '开始复习',
      },
      trend,
      metrics: [
        metric('activity', '学习活动', '2 次', '对话、概念、笔记与资料阅读的有效记录', 2, 'ready', 'LearningEvent · learning actions', '#activity-ledger'),
        metric('assessment', '评测通过', '不足以判断', '仅 1 次样本，至少需要 3 次', 1, 'insufficient', 'PracticeAttempt + InterviewAttempt', '/practice'),
        metric('retention', '复习保留', '不足以判断', '仅 1 次样本，至少需要 3 次', 1, 'insufficient', 'ReviewLog.rating', '/review'),
        metric('hints', '提示依赖', '不足以判断', '仅 1 次样本，至少需要 3 次', 1, 'insufficient', 'PracticeAttempt.hintCount', '/practice'),
      ],
      weakSkills: [],
      progress: [],
      recentActivities: activities,
    };
  }

  const activities = normalActivities();
  return {
    rangeDays,
    generatedAt: '2026-08-15T10:00:00.000Z',
    today: { dueReviews: 6, overdueReviews: 2, estimatedMinutes: 5, completedActions: 4 },
    recommendation: {
      eyebrow: '优先处理记忆负荷',
      title: '6 个概念已到复习时间',
      description: '其中 2 个已逾期，先主动回忆再继续新内容。',
      href: '/review',
      actionLabel: '开始复习',
    },
    trend,
    metrics: [
      metric('activity', '学习活动', '18 次', '对话、概念、笔记与资料阅读的有效记录', 18, 'ready', 'LearningEvent · learning actions', '#activity-ledger'),
      metric('assessment', '评测通过', '72%', '练习与面试合并计算 · 11 次样本', 11, 'ready', 'PracticeAttempt + InterviewAttempt', '/practice'),
      metric('retention', '复习保留', '83%', 'Hard / Good / Easy 计为取回 · 12 次样本', 12, 'ready', 'ReviewLog.rating', '/review'),
      metric('hints', '提示依赖', '29%', '至少使用一次提示的练习占比 · 7 次样本', 7, 'ready', 'PracticeAttempt.hintCount', '/practice'),
    ],
    weakSkills: [
      { conceptId: 'group-by', name: 'SQL 分组聚合', state: 'relearning', priority: 86, evidence: ['当前处于重学状态', '2 次练习未通过', '1 次练习使用提示'], sampleSize: 6, href: '/?concept=group-by', actionHref: '/practice?concept=group-by', actionLabel: '针对练习' },
      { conceptId: 'transaction', name: '数据库事务边界', state: 'learning', priority: 62, evidence: ['1 次面试判断未通过', '复习已经到期'], sampleSize: 4, href: '/?concept=transaction', actionHref: '/practice?concept=transaction', actionLabel: '针对练习' },
      { conceptId: 'index', name: '复合索引', state: 'reviewing', priority: 48, evidence: ['1 次主动回忆失败', 'FSRS 难度偏高'], sampleSize: 5, href: '/?concept=index', actionHref: '/review?concept=index', actionLabel: '开始复习' },
    ],
    progress: [
      { id: 'progress-1', title: '筛出高分学员', detail: 'SQL 评测 · 任务通过', createdAt: '2026-08-15T08:40:00.000Z', href: '/practice?attempt=practice-1' },
      { id: 'progress-2', title: '事务隔离与并发控制', detail: '面试作答 · 84 分 · 进阶', createdAt: '2026-08-14T11:20:00.000Z', href: '/interview?attempt=interview-1' },
      { id: 'progress-3', title: 'B+ 树索引', detail: '主动复习 · 成功取回 · good', createdAt: '2026-08-13T09:10:00.000Z', href: '/review?log=review-1' },
    ],
    recentActivities: activities,
  };
}

function buildTrend(rangeDays: AnalyticsRange, mode: FixtureMode): AnalyticsDay[] {
  const totals = mode === 'normal' ? [3, 1, 5, 2, 7, 4, 6] : mode === 'small' ? [0, 0, 0, 0, 1, 0, 2] : [0];
  return Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(2026, 7, 15);
    date.setDate(date.getDate() - (rangeDays - index - 1));
    const total = totals[(index - Math.max(0, rangeDays - 7) + totals.length) % totals.length] ?? 0;
    if (index < rangeDays - 7) return day(date, 0, 0, 0, 0);
    if (mode === 'empty') return day(date, 0, 0, 0, 0);
    const assessment = total >= 4 ? 1 : 0;
    const review = total >= 5 ? 2 : total >= 2 ? 1 : 0;
    return day(date, Math.max(0, total - assessment - review), assessment, review, total >= 6 ? 2 : 0);
  });
}

function day(date: Date, learning: number, assessment: number, review: number, hints: number): AnalyticsDay {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateNumber = String(date.getDate()).padStart(2, '0');
  return {
    date: `${year}-${month}-${dateNumber}`,
    label: `${date.getMonth() + 1}/${date.getDate()}`,
    learning,
    assessment,
    review,
    hints,
    total: learning + assessment + review,
  };
}

function metric(
  id: LearningAnalytics['metrics'][number]['id'],
  label: string,
  value: string,
  detail: string,
  sampleSize: number,
  status: LearningAnalytics['metrics'][number]['status'],
  source: string,
  href: string,
): LearningAnalytics['metrics'][number] {
  return { id, label, value, detail, sampleSize, status, source, href };
}

function normalActivities(): AnalyticsActivity[] {
  return [
    activity('a1', 'assessment', 'SQL 评测', '筛出高分学员', '任务通过', '2026-08-15T08:40:00.000Z', '/practice?attempt=practice-1'),
    activity('a2', 'review', '主动复习', 'B+ 树索引', '成功取回 · good', '2026-08-15T07:10:00.000Z', '/review?log=review-1&concept=index'),
    activity('a3', 'learning', '完成对话', '事务隔离级别如何选择', '回答已完成', '2026-08-15T06:50:00.000Z', '/?session=session-1&message=message-1'),
    activity('a4', 'learning', '发现概念', '可重复读', '进入概念库', '2026-08-15T06:49:00.000Z', '/?concept=repeatable-read'),
    activity('a5', 'assessment', '面试作答', '事务隔离与并发控制', '84 分 · 进阶', '2026-08-14T11:20:00.000Z', '/interview?attempt=interview-1'),
    activity('a6', 'review', '主动复习', 'MVCC', '未取回 · Again', '2026-08-14T08:00:00.000Z', '/review?log=review-2&concept=mvcc'),
    activity('a7', 'learning', '更新笔记', '数据库并发控制笔记', '知识已沉淀', '2026-08-13T12:00:00.000Z', '/notes?note=note-1'),
    activity('a8', 'assessment', 'SQL 评测', '统计部门均分', '未通过 · validation', '2026-08-13T09:30:00.000Z', '/practice?attempt=practice-2'),
    activity('a9', 'learning', '保存摘录', 'PostgreSQL 事务文档', '摘录已保存', '2026-08-12T14:20:00.000Z', '/resources?resource=resource-1'),
    activity('a10', 'review', '主动复习', 'GROUP BY', '成功取回 · hard', '2026-08-11T07:30:00.000Z', '/review?log=review-3&concept=group-by'),
  ];
}

function activity(
  id: string,
  category: AnalyticsActivity['category'],
  actionLabel: string,
  objectTitle: string,
  resultLabel: string,
  createdAt: string,
  href: string,
): AnalyticsActivity {
  return { id, category, actionLabel, objectTitle, resultLabel, createdAt, date: createdAt.slice(0, 10), href };
}
