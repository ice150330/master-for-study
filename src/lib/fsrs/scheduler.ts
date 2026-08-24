import {
  Rating,
  S_MAX,
  S_MIN,
  State,
  createEmptyCard,
  fsrs,
  type Card,
  type Grade,
  type ReviewLog,
} from 'ts-fsrs';

export const REVIEW_ALGORITHM_VERSION = 'ts-fsrs-6@5.4.1';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export type ReviewCardState = 'new' | 'learning' | 'reviewing' | 'relearning';

export type StoredReviewCard = {
  dueAt: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: ReviewCardState;
  lastReviewAt: Date | null;
};

export type StoredReviewLog = {
  rating: ReviewGrade;
  state: ReviewCardState;
  dueAt: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reviewAt: Date;
};

export type ReviewOutcome = {
  card: StoredReviewCard;
  log: StoredReviewLog;
};

export type ReviewPreview = Record<ReviewGrade, StoredReviewCard>;

export function formatReviewInterval(now: Date, dueAt: Date): string {
  const minutes = Math.max(1, Math.ceil((dueAt.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} 个月`;
  return `${Math.round(months / 12)} 年`;
}

/** 调度器保留率基线：调用方未指定时沿用历史行为（ts-fsrs 默认 0.9）。 */
export const DEFAULT_REQUEST_RETENTION = 0.9;

/** 保留率 → 调度器实例缓存：可配置项面板只允许离散档位，实例数有界。 */
const schedulerCache = new Map<number, ReturnType<typeof fsrs>>();

function schedulerFor(retention: number) {
  const key = Math.min(1, Math.max(0.7, Math.round(retention * 100) / 100));
  let instance = schedulerCache.get(key);
  if (!instance) {
    instance = fsrs({
      request_retention: key,
      maximum_interval: 36_500,
      enable_fuzz: false,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    });
    schedulerCache.set(key, instance);
  }
  return instance;
}

const scheduler = schedulerFor(DEFAULT_REQUEST_RETENTION);

const stateToFsrs: Record<ReviewCardState, State> = {
  new: State.New,
  learning: State.Learning,
  reviewing: State.Review,
  relearning: State.Relearning,
};

const stateFromFsrs: Record<State, ReviewCardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'reviewing',
  [State.Relearning]: 'relearning',
};

const ratingToFsrs: Record<ReviewGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const ratingFromFsrs: Record<Rating, ReviewGrade | null> = {
  [Rating.Manual]: null,
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
};

function toFsrsCard(card: StoredReviewCard): Card {
  const normalized = normalizeReviewCard(card);
  return {
    due: normalized.dueAt,
    stability: normalized.stability,
    difficulty: normalized.difficulty,
    elapsed_days: 0,
    scheduled_days: normalized.scheduledDays,
    learning_steps: normalized.learningSteps,
    reps: normalized.reps,
    lapses: normalized.lapses,
    state: stateToFsrs[normalized.state],
    last_review: normalized.lastReviewAt ?? undefined,
  };
}

/** 兼容简化调度器留下的非新卡零值；新卡的 0/0 是 ts-fsrs 的合法初始态。 */
function normalizeReviewCard(card: StoredReviewCard): StoredReviewCard {
  if (card.state === 'new') {
    return {
      ...card,
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
    };
  }
  const stability = Number.isFinite(card.stability)
    ? Math.min(S_MAX, Math.max(S_MIN, card.stability))
    : S_MIN;
  const difficulty = Number.isFinite(card.difficulty)
    ? Math.min(10, Math.max(1, card.difficulty))
    : 5;
  return {
    ...card,
    stability,
    difficulty,
    scheduledDays: Math.max(0, Math.round(card.scheduledDays || 0)),
    learningSteps: Math.max(0, Math.round(card.learningSteps || 0)),
    reps: Math.max(0, Math.round(card.reps || 0)),
    lapses: Math.max(0, Math.round(card.lapses || 0)),
  };
}

function fromFsrsCard(card: Card): StoredReviewCard {
  return {
    dueAt: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateFromFsrs[card.state],
    lastReviewAt: card.last_review ?? null,
  };
}

function fromFsrsLog(log: ReviewLog): StoredReviewLog {
  const rating = ratingFromFsrs[log.rating];
  if (!rating) throw new Error('手动评级不能写入自动复习日志');
  return {
    rating,
    state: stateFromFsrs[log.state],
    dueAt: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    reviewAt: log.review,
  };
}

function toFsrsLog(log: StoredReviewLog): ReviewLog {
  return {
    rating: ratingToFsrs[log.rating],
    state: stateToFsrs[log.state],
    due: log.dueAt,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsedDays,
    last_elapsed_days: log.lastElapsedDays,
    scheduled_days: log.scheduledDays,
    learning_steps: log.learningSteps,
    review: log.reviewAt,
  };
}

export function createReviewCard(now = new Date()): StoredReviewCard {
  return fromFsrsCard(createEmptyCard(now));
}

export function previewReview(
  card: StoredReviewCard,
  now = new Date(),
  retention: number = DEFAULT_REQUEST_RETENTION,
): ReviewPreview {
  const preview = schedulerFor(retention).repeat(toFsrsCard(card), now);
  return {
    again: fromFsrsCard(preview[Rating.Again].card),
    hard: fromFsrsCard(preview[Rating.Hard].card),
    good: fromFsrsCard(preview[Rating.Good].card),
    easy: fromFsrsCard(preview[Rating.Easy].card),
  };
}

export function scheduleReview(
  card: StoredReviewCard,
  grade: ReviewGrade,
  now = new Date(),
  retention: number = DEFAULT_REQUEST_RETENTION,
): ReviewOutcome {
  const result = schedulerFor(retention).next(toFsrsCard(card), now, ratingToFsrs[grade]);
  return { card: fromFsrsCard(result.card), log: fromFsrsLog(result.log) };
}

export function rollbackReview(card: StoredReviewCard, log: StoredReviewLog): StoredReviewCard {
  return fromFsrsCard(scheduler.rollback(toFsrsCard(card), toFsrsLog(log)));
}
