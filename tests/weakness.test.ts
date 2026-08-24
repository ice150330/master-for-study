import { describe, expect, it } from 'vitest';
import { slowRecallFactor, weaknessScore } from '../src/lib/analytics/weakness';

describe('薄弱度评分（B4 隐性感知）', () => {
  it('难度缺失按中性 5 计，状态加权 relearning > learning > reviewing', () => {
    const base = { avgDurationMs: null, medianDurationMs: null } as const;
    expect(weaknessScore({ difficulty: null, state: 'reviewing', ...base })).toBe(5);
    expect(weaknessScore({ difficulty: null, state: 'learning', ...base })).toBe(6);
    expect(weaknessScore({ difficulty: null, state: 'relearning', ...base })).toBe(7);
    expect(weaknessScore({ difficulty: 8.5, state: 'reviewing', ...base })).toBeCloseTo(8.5);
  });

  it('回忆显著偏慢加权：超过中位 1.2 倍起计、每多 40% 加 1 分、封顶 3 分', () => {
    // 中位 10s：12s 起计
    expect(slowRecallFactor(11_000, 10_000)).toBe(0);
    expect(slowRecallFactor(12_000, 10_000)).toBeCloseTo(0);
    expect(slowRecallFactor(16_000, 10_000)).toBeCloseTo(1);
    expect(slowRecallFactor(24_000, 10_000)).toBeCloseTo(3);
    expect(slowRecallFactor(60_000, 10_000)).toBe(3);
    // 缺数据不加权
    expect(slowRecallFactor(null, 10_000)).toBe(0);
    expect(slowRecallFactor(20_000, null)).toBe(0);
    expect(slowRecallFactor(20_000, 0)).toBe(0);
  });

  it('难度相同、状态相同时，回忆更慢的概念得分更高', () => {
    const fast = weaknessScore({ difficulty: 6, state: 'reviewing', avgDurationMs: 5_000, medianDurationMs: 10_000 });
    const slow = weaknessScore({ difficulty: 6, state: 'reviewing', avgDurationMs: 30_000, medianDurationMs: 10_000 });
    expect(slow).toBeGreaterThan(fast);
  });
});
