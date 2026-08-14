import type {
  InterviewDifficulty,
  InterviewDimensionScore,
  InterviewEvidence,
  InterviewRole,
  InterviewStrategy,
  InterviewTeacherStyle,
  InterviewTopic,
} from '@/lib/interview/types';

export type InterviewAttemptDto = {
  id: string;
  interviewId: string;
  version: number;
  answer: string;
  durationMs: number;
  scores: Record<'correctness' | 'structure' | 'evidence' | 'communication', InterviewDimensionScore>;
  evidence: InterviewEvidence[];
  summary: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
  correct: boolean;
  nextStrategy: InterviewStrategy;
  prerequisite: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type InterviewQuestionDto = {
  id: string;
  sessionId: string | null;
  workspaceId: string | null;
  interviewSessionId: string | null;
  termId: string | null;
  roundIndex: number;
  skill: string;
  difficulty: InterviewDifficulty;
  rubric: Record<'correctness' | 'structure' | 'evidence' | 'communication', string>;
  followUp: string | null;
  question: string;
  answer: string | null;
  feedback: string | null;
  correct: boolean | null;
  createdAt: string;
  attempts: InterviewAttemptDto[];
};

export type InterviewSessionDto = {
  id: string;
  workspaceId: string;
  role: InterviewRole;
  topic: InterviewTopic;
  initialDifficulty: InterviewDifficulty;
  currentDifficulty: InterviewDifficulty;
  totalRounds: number;
  currentRound: number;
  teacherStyle: InterviewTeacherStyle;
  status: 'active' | 'completed';
  lastStrategy: InterviewStrategy | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type InterviewSessionDetailDto = {
  session: InterviewSessionDto;
  questions: InterviewQuestionDto[];
};
