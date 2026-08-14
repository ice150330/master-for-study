import { describe, expect, it } from 'vitest';
import {
  REVIEW_ALGORITHM_VERSION,
  createReviewCard,
  previewReview,
  rollbackReview,
  scheduleReview,
} from '../src/lib/fsrs';

describe('正式 FSRS 调度适配器', () => {
  const now = new Date('2026-08-15T08:00:00.000Z');

  it('使用可追踪的 FSRS 6 实现版本', () => {
    expect(REVIEW_ALGORITHM_VERSION).toBe('ts-fsrs-6@5.4.1');
  });

  it('四档预览按同一时间生成且 Again 不会零间隔循环', () => {
    const card = createReviewCard(now);
    const preview = previewReview(card, now);
    expect(preview.again.dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect(preview.hard.dueAt.getTime()).toBeGreaterThan(preview.again.dueAt.getTime());
    expect(preview.good.dueAt.getTime()).toBeGreaterThan(preview.hard.dueAt.getTime());
    expect(preview.easy.dueAt.getTime()).toBeGreaterThan(preview.good.dueAt.getTime());
  });

  it('按钮预览与最终 API 排期来自同一结果', () => {
    const card = createReviewCard(now);
    const preview = previewReview(card, now);
    const outcome = scheduleReview(card, 'good', now);
    expect(outcome.card).toEqual(preview.good);
    expect(outcome.log.rating).toBe('good');
    expect(outcome.log.reviewAt).toEqual(now);
  });

  it('撤销恢复到评级前的完整卡片状态', () => {
    const card = createReviewCard(now);
    const outcome = scheduleReview(card, 'easy', now);
    expect(rollbackReview(outcome.card, outcome.log)).toEqual(card);
  });
});
