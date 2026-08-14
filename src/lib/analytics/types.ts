export type AnalyticsRange = 7 | 30;

export type AnalyticsActivityCategory = 'learning' | 'assessment' | 'review';

export type AnalyticsDay = {
  date: string;
  label: string;
  learning: number;
  assessment: number;
  review: number;
  hints: number;
  total: number;
};

export type AnalyticsMetric = {
  id: 'activity' | 'assessment' | 'retention' | 'hints';
  label: string;
  value: string;
  detail: string;
  sampleSize: number;
  status: 'ready' | 'insufficient';
  source: string;
  href: string;
};

export type AnalyticsWeakSkill = {
  conceptId: string;
  name: string;
  state: 'new' | 'learning' | 'reviewing' | 'relearning';
  priority: number;
  evidence: string[];
  sampleSize: number;
  href: string;
  actionHref: string;
  actionLabel: string;
};

export type AnalyticsProgress = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  href: string;
};

export type AnalyticsActivity = {
  id: string;
  category: AnalyticsActivityCategory;
  actionLabel: string;
  objectTitle: string;
  resultLabel: string;
  createdAt: string;
  date: string;
  href: string;
};

export type LearningAnalytics = {
  rangeDays: AnalyticsRange;
  generatedAt: string;
  today: {
    dueReviews: number;
    overdueReviews: number;
    estimatedMinutes: number;
    completedActions: number;
  };
  recommendation: {
    eyebrow: string;
    title: string;
    description: string;
    href: string;
    actionLabel: string;
  };
  trend: AnalyticsDay[];
  metrics: AnalyticsMetric[];
  weakSkills: AnalyticsWeakSkill[];
  progress: AnalyticsProgress[];
  recentActivities: AnalyticsActivity[];
};

export type AnalyticsEventInput = {
  id: string;
  action: string;
  objectType: string;
  objectId: string | null;
  sessionId: string | null;
  result: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  createdAt: Date;
};

export type AnalyticsPracticeInput = {
  id: string;
  conceptId: string | null;
  challengeId: string;
  status: 'success' | 'error';
  hintCount: number;
  skills: string[];
  createdAt: Date;
};

export type AnalyticsInterviewInput = {
  id: string;
  interviewId: string;
  termId: string | null;
  skill: string;
  correct: boolean;
  score: number;
  nextStrategy: 'advance' | 'stay' | 'downgrade';
  createdAt: Date;
};

export type AnalyticsReviewInput = {
  id: string;
  termId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  reviewAt: Date;
};

export type AnalyticsConceptInput = {
  id: string;
  name: string;
  state: AnalyticsWeakSkill['state'];
  difficulty: number | null;
  dueAt: Date | null;
};
