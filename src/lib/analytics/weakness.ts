/**
 * 薄弱度评分（优化方向 B4 · 蓝图 2.1 隐性感知）。
 * 难度为主信号，主动回忆耗时相对全局中位显著偏慢时加权——
 * "答对但想得慢"也是薄弱的证据，而不仅看评级。
 */

export type WeaknessInput = {
  /** FSRS 难度 1–10；null 视作中性 5 */
  difficulty: number | null;
  /** 掌握状态：relearning / learning 加权 */
  state: string;
  /** 该概念的平均主动回忆耗时（毫秒）；null = 无数据 */
  avgDurationMs: number | null;
  /** 全局中位回忆耗时（毫秒）作基准；null = 无基准 */
  medianDurationMs: number | null;
};

export function weaknessScore(input: WeaknessInput): number {
  const difficulty = input.difficulty !== null && Number.isFinite(input.difficulty)
    ? input.difficulty
    : 5;
  const stateBump = input.state === 'relearning' ? 2 : input.state === 'learning' ? 1 : 0;
  return difficulty + stateBump + slowRecallFactor(input.avgDurationMs, input.medianDurationMs);
}

/**
 * 回忆偏慢加权：avg 超过中位 1.2 倍起计，每多 40% 加 1 分，封顶 3 分。
 * 缺数据（任一为 null、中位非正数）不加权，保持纯难度语义。
 */
export function slowRecallFactor(avgDurationMs: number | null, medianDurationMs: number | null): number {
  if (avgDurationMs === null || medianDurationMs === null || medianDurationMs <= 0 || avgDurationMs <= 0) {
    return 0;
  }
  const ratio = avgDurationMs / medianDurationMs;
  if (ratio <= 1.2) return 0;
  return Math.min(3, (ratio - 1.2) / 0.4);
}
