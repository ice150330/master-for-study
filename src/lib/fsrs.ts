/**
 * 间隔重复调度器（简化版 FSRS / SM-2 变体）。
 *
 * 术语掌握度状态机：new → learning → reviewing，遗忘则进入 relearning。
 * - stability：记忆稳定性（天），越大复习间隔越长
 * - difficulty：难度（1-10），越大越难记住
 * 目标保留率约 85%（通过稳定性系数近似，正式 FSRS 后可替换）。
 */

export type TermState = 'new' | 'learning' | 'reviewing' | 'relearning';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type ScheduleInput = {
  state: TermState;
  stability: number;
  difficulty: number;
};

export type ScheduleResult = {
  state: TermState;
  stability: number;
  difficulty: number;
  dueDays: number;
};

/** 非「again」评级的稳定性系数（乘以难度修正）。 */
const STABILITY_FACTOR: Record<Exclude<ReviewGrade, 'again'>, number> = {
  hard: 1.2,
  good: 2.0,
  easy: 2.6,
};

/** 进入 reviewing 状态所需的最小稳定性（天）。 */
const REVIEWING_THRESHOLD = 21;

export function scheduleReview(input: ScheduleInput, grade: ReviewGrade): ScheduleResult {
  const { stability, difficulty } = input;

  if (grade === 'again') {
    // 遗忘：稳定性归零，难度升高，立即重学
    return {
      state: 'relearning',
      stability: 0,
      difficulty: Math.min(difficulty + 1, 10),
      dueDays: 0,
    };
  }

  // 难度修正：越难（difficulty 大）稳定性增长越慢
  const ease = (11 - difficulty) / 10;
  const nextStability = Math.max(
    stability === 0 ? 1 : stability * STABILITY_FACTOR[grade] * ease,
    grade === 'hard' ? 1 : 2,
  );
  const nextDifficulty = Math.max(difficulty - (grade === 'easy' ? 0.5 : 0), 1);
  const nextState: TermState = nextStability >= REVIEWING_THRESHOLD ? 'reviewing' : 'learning';

  return {
    state: nextState,
    stability: nextStability,
    difficulty: nextDifficulty,
    dueDays: Math.round(nextStability),
  };
}
