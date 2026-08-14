import { describe, expect, it } from 'vitest';
import {
  adaptInterviewDifficulty,
  interviewOverallScore,
  normalizeInterviewEvaluation,
  type InterviewEvaluation,
} from '../src/lib/interview/types';

const evaluation: InterviewEvaluation = {
  correct: true,
  scores: {
    correctness: { score: 5, note: '正确' },
    structure: { score: 4, note: '清楚' },
    evidence: { score: 3, note: '有依据' },
    communication: { score: 6, note: '表达完整' },
  },
  summary: '整体合格。',
  strengths: ['判断准确'],
  improvements: ['补充量化依据'],
  evidence: [{ dimension: 'evidence', quote: '不存在的原话', note: '错误引用' }],
  modelAnswer: '参考答案',
  nextStrategy: 'advance',
  prerequisite: '  ',
};

describe('模拟面试难度与评分契约', () => {
  it('advance/stay/downgrade 在三档边界内变化', () => {
    expect(adaptInterviewDifficulty('foundation', 'downgrade')).toBe('foundation');
    expect(adaptInterviewDifficulty('foundation', 'advance')).toBe('standard');
    expect(adaptInterviewDifficulty('standard', 'stay')).toBe('standard');
    expect(adaptInterviewDifficulty('advanced', 'advance')).toBe('advanced');
    expect(adaptInterviewDifficulty('advanced', 'downgrade')).toBe('standard');
  });

  it('评分归一到 1-5 并计算百分制总分', () => {
    const normalized = normalizeInterviewEvaluation(evaluation, '我会先确认容量，再选择索引。');
    expect(normalized.scores.communication.score).toBe(5);
    expect(interviewOverallScore(normalized.scores)).toBe(85);
  });

  it('过滤伪造引用并回退到真实回答片段', () => {
    const answer = '我会先确认容量，再选择索引。';
    const normalized = normalizeInterviewEvaluation(evaluation, answer);
    expect(normalized.evidence).toEqual([
      { dimension: 'correctness', quote: answer, note: '该片段用于核对回答中的核心判断。' },
    ]);
    expect(normalized.prerequisite).toBeNull();
  });
});
