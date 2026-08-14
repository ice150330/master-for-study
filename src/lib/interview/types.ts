export const INTERVIEW_ROLES = [
  { value: 'backend', label: '后端工程师' },
  { value: 'frontend', label: '前端工程师' },
  { value: 'fullstack', label: '全栈工程师' },
  { value: 'data', label: '数据工程师' },
] as const;

export const INTERVIEW_TOPICS = [
  { value: 'system-design', label: '系统设计' },
  { value: 'database', label: '数据库' },
  { value: 'engineering', label: '工程实践' },
  { value: 'behavioral', label: '项目与协作' },
] as const;

export const INTERVIEW_DIFFICULTIES = [
  { value: 'foundation', label: '基础' },
  { value: 'standard', label: '标准' },
  { value: 'advanced', label: '进阶' },
] as const;

export const INTERVIEW_STYLES = [
  { value: 'guided', label: '引导型' },
  { value: 'rigorous', label: '严格型' },
  { value: 'concise', label: '简洁型' },
] as const;

export type InterviewRole = (typeof INTERVIEW_ROLES)[number]['value'];
export type InterviewTopic = (typeof INTERVIEW_TOPICS)[number]['value'];
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number]['value'];
export type InterviewTeacherStyle = (typeof INTERVIEW_STYLES)[number]['value'];
export type InterviewStrategy = 'advance' | 'stay' | 'downgrade';
export type InterviewDimension = 'correctness' | 'structure' | 'evidence' | 'communication';

export type InterviewSettings = {
  role: InterviewRole;
  topic: InterviewTopic;
  difficulty: InterviewDifficulty;
  totalRounds: 3 | 5;
  teacherStyle: InterviewTeacherStyle;
};

export type InterviewQuestionDraft = {
  question: string;
  skill: string;
  rubric: Record<InterviewDimension, string>;
};

export type InterviewDimensionScore = {
  score: number;
  note: string;
};

export type InterviewEvidence = {
  dimension: InterviewDimension;
  quote: string;
  note: string;
};

export type InterviewEvaluation = {
  correct: boolean;
  scores: Record<InterviewDimension, InterviewDimensionScore>;
  summary: string;
  strengths: string[];
  improvements: string[];
  evidence: InterviewEvidence[];
  modelAnswer: string;
  nextStrategy: InterviewStrategy;
  prerequisite: string | null;
};

const difficultyOrder: InterviewDifficulty[] = ['foundation', 'standard', 'advanced'];

export function adaptInterviewDifficulty(
  current: InterviewDifficulty,
  strategy: InterviewStrategy,
): InterviewDifficulty {
  const index = difficultyOrder.indexOf(current);
  if (strategy === 'advance') return difficultyOrder[Math.min(index + 1, difficultyOrder.length - 1)];
  if (strategy === 'downgrade') return difficultyOrder[Math.max(index - 1, 0)];
  return current;
}

export function interviewOverallScore(scores: InterviewEvaluation['scores']) {
  const values = Object.values(scores).map((item) => clampScore(item.score));
  return Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 20);
}

/** AI 引用必须能在原回答中找到，避免生成不存在的“原话”。 */
export function normalizeInterviewEvaluation(
  evaluation: InterviewEvaluation,
  answer: string,
): InterviewEvaluation {
  const normalizedScores = Object.fromEntries(
    Object.entries(evaluation.scores).map(([dimension, value]) => [
      dimension,
      { ...value, score: clampScore(value.score) },
    ]),
  ) as InterviewEvaluation['scores'];
  const evidence = evaluation.evidence.filter((item) => item.quote && answer.includes(item.quote));
  if (evidence.length === 0) {
    const quote = answer.trim().slice(0, 120);
    if (quote) {
      evidence.push({
        dimension: 'correctness',
        quote,
        note: '该片段用于核对回答中的核心判断。',
      });
    }
  }
  return {
    ...evaluation,
    scores: normalizedScores,
    evidence,
    prerequisite: evaluation.prerequisite?.trim() || null,
  };
}

function clampScore(score: number) {
  return Math.min(5, Math.max(1, Math.round(score)));
}

export function interviewOptionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
