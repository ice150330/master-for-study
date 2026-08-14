import { describe, expect, it } from 'vitest';
import { scheduleReview } from '../src/lib/fsrs';

describe('scheduleReview 间隔重复调度', () => {
  it('遗忘（again）重置稳定性并降为 relearning', () => {
    const r = scheduleReview({ state: 'reviewing', stability: 30, difficulty: 5 }, 'again');
    expect(r.state).toBe('relearning');
    expect(r.stability).toBe(0);
    expect(r.dueDays).toBe(0);
    expect(r.difficulty).toBe(6);
  });

  it('新术语答对（good）获得正稳定性', () => {
    const r = scheduleReview({ state: 'new', stability: 0, difficulty: 5 }, 'good');
    expect(r.stability).toBeGreaterThan(0);
    expect(r.dueDays).toBeGreaterThan(0);
  });

  it('easy 比 good 的复习间隔更长', () => {
    const good = scheduleReview({ state: 'learning', stability: 5, difficulty: 5 }, 'good');
    const easy = scheduleReview({ state: 'learning', stability: 5, difficulty: 5 }, 'easy');
    expect(easy.stability).toBeGreaterThan(good.stability);
  });

  it('难度越高稳定性增长越慢', () => {
    const easy = scheduleReview({ state: 'learning', stability: 5, difficulty: 2 }, 'good');
    const hard = scheduleReview({ state: 'learning', stability: 5, difficulty: 9 }, 'good');
    expect(hard.stability).toBeLessThan(easy.stability);
  });

  it('稳定性超过阈值进入 reviewing', () => {
    const r = scheduleReview({ state: 'learning', stability: 20, difficulty: 2 }, 'easy');
    expect(r.state).toBe('reviewing');
  });
});
