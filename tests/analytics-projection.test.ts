import { describe, expect, it } from 'vitest';
import {
  analyticsCategory,
  buildActivityTrend,
  buildAnalyticsMetrics,
  rankWeakSkills,
} from '../src/lib/analytics/projection';
import type {
  AnalyticsEventInput,
  AnalyticsPracticeInput,
  AnalyticsReviewInput,
} from '../src/lib/analytics/types';

const now = new Date(2026, 7, 15, 18, 0, 0);

describe('成长分析投影', () => {
  it('只把有效学习行为分到三类', () => {
    expect(analyticsCategory('message_sent')).toBe('learning');
    expect(analyticsCategory('practice_attempted')).toBe('assessment');
    expect(analyticsCategory('reviewed')).toBe('review');
    expect(analyticsCategory('knowledge_layout_changed')).toBeNull();
  });

  it('补齐时间范围内的空白日期并保留提示次数', () => {
    const trend = buildActivityTrend([
      event('message_sent', new Date(2026, 7, 13, 10)),
      event('practice_attempted', new Date(2026, 7, 15, 9), { hintCount: 2 }),
      event('reviewed', new Date(2026, 7, 15, 11)),
    ], 7, now);

    expect(trend).toHaveLength(7);
    expect(trend[4]).toMatchObject({ date: '2026-08-13', learning: 1, total: 1 });
    expect(trend[5]).toMatchObject({ date: '2026-08-14', total: 0 });
    expect(trend[6]).toMatchObject({ assessment: 1, review: 1, hints: 2, total: 2 });
  });

  it('样本不足时不输出具有误导性的百分比', () => {
    const metrics = buildAnalyticsMetrics({
      events: [event('message_sent', now)],
      practiceAttempts: [practice('p1', 'success', 0), practice('p2', 'error', 1)],
      interviewAttempts: [],
      reviewLogs: [review('r1', 'good')],
    });

    expect(metrics.find((metric) => metric.id === 'activity')?.value).toBe('1 次');
    expect(metrics.find((metric) => metric.id === 'assessment')).toMatchObject({
      value: '不足以判断',
      status: 'insufficient',
      sampleSize: 2,
    });
    expect(metrics.find((metric) => metric.id === 'retention')?.value).toBe('不足以判断');
  });

  it('达到阈值后由 Attempt 与 ReviewLog 计算比率', () => {
    const metrics = buildAnalyticsMetrics({
      events: [],
      practiceAttempts: [
        practice('p1', 'success', 0),
        practice('p2', 'success', 1),
        practice('p3', 'error', 1),
      ],
      interviewAttempts: [],
      reviewLogs: [review('r1', 'good'), review('r2', 'easy'), review('r3', 'again')],
    });
    expect(metrics.find((metric) => metric.id === 'assessment')?.value).toBe('67%');
    expect(metrics.find((metric) => metric.id === 'retention')?.value).toBe('67%');
    expect(metrics.find((metric) => metric.id === 'hints')?.value).toBe('67%');
  });

  it('失败、提示与重学状态共同提高薄弱项优先级', () => {
    const skills = rankWeakSkills({
      now,
      concepts: [
        { id: 'sql', name: 'SQL 聚合', state: 'relearning', difficulty: 8, dueAt: new Date(2026, 7, 14) },
        { id: 'http', name: 'HTTP', state: 'reviewing', difficulty: 4, dueAt: new Date(2026, 7, 20) },
      ],
      practiceAttempts: [
        { ...practice('p1', 'error', 2), conceptId: 'sql' },
        { ...practice('p2', 'error', 1), conceptId: 'sql' },
      ],
      interviewAttempts: [],
      reviewLogs: [review('r1', 'again', 'sql')],
    });

    expect(skills[0]).toMatchObject({
      conceptId: 'sql',
      actionLabel: '模拟测验',
      sampleSize: 3,
    });
    expect(skills[0].evidence).toContain('当前处于重学状态');
    expect(skills.some((skill) => skill.conceptId === 'http')).toBe(false);
  });
});

function event(
  action: string,
  createdAt: Date,
  context: Record<string, unknown> | null = null,
): AnalyticsEventInput {
  return {
    id: `${action}-${createdAt.getTime()}`,
    action,
    objectType: 'message',
    objectId: null,
    sessionId: null,
    result: null,
    context,
    createdAt,
  };
}

function practice(id: string, status: 'success' | 'error', hintCount: number): AnalyticsPracticeInput {
  return {
    id,
    conceptId: null,
    challengeId: 'sql-filter-sort',
    status,
    hintCount,
    skills: ['WHERE'],
    createdAt: now,
  };
}

function review(id: string, rating: AnalyticsReviewInput['rating'], termId = 'term'): AnalyticsReviewInput {
  return { id, termId, rating, reviewAt: now };
}
