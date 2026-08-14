import { generateText, Output } from 'ai';
import { z } from 'zod';
import {
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_ROLES,
  INTERVIEW_STYLES,
  INTERVIEW_TOPICS,
  interviewOptionLabel,
  normalizeInterviewEvaluation,
  type InterviewEvaluation,
  type InterviewQuestionDraft,
  type InterviewSettings,
} from '../interview/types';
import { fastModel, proModel } from './provider';

const QuestionSchema = z.object({
  question: z.string().min(12).max(1_200),
  skill: z.string().min(2).max(80),
  rubric: z.object({
    correctness: z.string().min(2).max(300),
    structure: z.string().min(2).max(300),
    evidence: z.string().min(2).max(300),
    communication: z.string().min(2).max(300),
  }),
});

const JudgeSchema = z.object({
  correct: z.boolean(),
  scores: z.object({
    correctness: dimensionScoreSchema(),
    structure: dimensionScoreSchema(),
    evidence: dimensionScoreSchema(),
    communication: dimensionScoreSchema(),
  }),
  summary: z.string().min(4).max(800),
  strengths: z.array(z.string().min(2).max(300)).max(4),
  improvements: z.array(z.string().min(2).max(300)).max(4),
  evidence: z.array(z.object({
    dimension: z.enum(['correctness', 'structure', 'evidence', 'communication']),
    quote: z.string().min(1).max(180),
    note: z.string().min(2).max(300),
  })).max(6),
  modelAnswer: z.string().min(10).max(4_000),
  nextStrategy: z.enum(['advance', 'stay', 'downgrade']),
  prerequisite: z.string().min(2).max(80).nullable(),
});

function dimensionScoreSchema() {
  return z.object({
    score: z.number().int().min(1).max(5),
    note: z.string().min(2).max(300),
  });
}

export async function generateQuestion(input: {
  settings: InterviewSettings;
  roundIndex: number;
  previousSummary?: string | null;
  prerequisite?: string | null;
}): Promise<InterviewQuestionDraft> {
  const { settings } = input;
  const { output } = await generateText({
    model: fastModel,
    output: Output.object({ schema: QuestionSchema }),
    prompt: [
      '你是一位技术面试官，请生成一道可在 3-6 分钟内书面回答的题目。',
      `岗位：${interviewOptionLabel(INTERVIEW_ROLES, settings.role)}`,
      `主题：${interviewOptionLabel(INTERVIEW_TOPICS, settings.topic)}`,
      `难度：${interviewOptionLabel(INTERVIEW_DIFFICULTIES, settings.difficulty)}`,
      `面试官风格：${interviewOptionLabel(INTERVIEW_STYLES, settings.teacherStyle)}`,
      `当前轮次：${input.roundIndex}/${settings.totalRounds}`,
      input.previousSummary ? `上一题反馈摘要：${input.previousSummary}` : '',
      input.prerequisite ? `本题应回退检查的前置知识：${input.prerequisite}` : '',
      '',
      '题目必须具体、只有一个主要考察点，不要输出答案、提示、评分线索或 rubric。',
      'skill 使用一个简短、可作为知识点名称的中文短语。',
      'rubric 的四个字段仅供系统判分，不会在作答前展示。',
    ].filter(Boolean).join('\n'),
  });
  return output;
}

export async function generateFollowUp(input: {
  question: string;
  answerDraft?: string;
  teacherStyle: InterviewSettings['teacherStyle'];
}) {
  const { text } = await generateText({
    model: fastModel,
    prompt: [
      '你是正在进行技术面试的面试官。',
      `原题：${input.question}`,
      input.answerDraft ? `候选人目前的回答：${input.answerDraft}` : '',
      `风格：${interviewOptionLabel(INTERVIEW_STYLES, input.teacherStyle)}`,
      '只提出一个简短的澄清或追问，用于让候选人补充权衡、依据或边界。',
      '不要给答案、提示正确方向、复述 rubric，也不要评价当前回答。',
    ].filter(Boolean).join('\n'),
  });
  return text.trim();
}

export async function judgeAnswer(input: {
  question: string;
  answer: string;
  difficulty: InterviewSettings['difficulty'];
  rubric: InterviewQuestionDraft['rubric'];
  followUp?: string | null;
}): Promise<InterviewEvaluation> {
  const { output } = await generateText({
    model: proModel,
    output: Output.object({ schema: JudgeSchema }),
    prompt: [
      '你是一位严格但具体的技术面试官，请评估候选人的回答。',
      `难度：${interviewOptionLabel(INTERVIEW_DIFFICULTIES, input.difficulty)}`,
      `题目：${input.question}`,
      input.followUp ? `面试官追问：${input.followUp}` : '',
      `回答：${input.answer}`,
      '',
      `正确性标准：${input.rubric.correctness}`,
      `结构标准：${input.rubric.structure}`,
      `证据标准：${input.rubric.evidence}`,
      `表达标准：${input.rubric.communication}`,
      '',
      '四维各给 1-5 分和一句具体说明。evidence.quote 必须逐字摘自用户回答，不得改写或杜撰。',
      'nextStrategy：明显达标且平均分不低于 4 为 advance；部分达标为 stay；核心知识错误为 downgrade。',
      'downgrade 时 prerequisite 给出一个可学习的前置知识短语，否则为 null。',
      'modelAnswer 给出结构化参考回答，但保持精炼。',
    ].filter(Boolean).join('\n'),
  });
  return normalizeInterviewEvaluation(output, input.answer);
}
