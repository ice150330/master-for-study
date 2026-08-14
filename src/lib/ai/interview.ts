import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { fastModel, proModel } from './provider';

/**
 * 模拟面试：依据画像 / 上下文出题，答后分层判分（对 → 推进，错 → 降级到前置知识）。
 * 出题用 fastModel，判分用 proModel。
 */

/** 生成一道面试题（可选传入上下文 / 薄弱点）。 */
export async function generateQuestion(context?: string): Promise<string> {
  const { text } = await generateText({
    model: fastModel,
    prompt: [
      '你是一位面试官。请出一道有针对性的技术面试题，',
      '要求：具体、有明确的考察点、适合口头或书面作答。',
      context ? `结合以下背景（如用户的薄弱点 / 近期学习内容）来出题：\n${context}` : '围绕一个常见技术主题出题。',
      '',
      '只输出题目本身，不要解释。',
    ].join('\n'),
  });
  return text.trim();
}

const JudgeSchema = z.object({
  correct: z.boolean().describe('回答是否正确 / 合格'),
  feedback: z.string().describe('针对回答的反馈：肯定亮点 + 指出不足 + 给出正确答案或提示'),
  level: z
    .enum(['advance', 'stay', 'downgrade'])
    .describe('下一步难度策略：advance=答对推进，stay=部分对维持，downgrade=答错降级'),
});

export type JudgeResult = z.infer<typeof JudgeSchema>;

/** 对回答分层判分。 */
export async function judgeAnswer(question: string, answer: string): Promise<JudgeResult> {
  const { object } = await generateObject({
    model: proModel,
    schema: JudgeSchema,
    schemaName: 'InterviewJudge',
    schemaDescription: '面试回答的判分与反馈',
    prompt: [
      '你是一位面试官，正在判分一道技术面试题的回答。',
      '',
      `题目：${question}`,
      '',
      `回答：${answer}`,
      '',
      '请给出：',
      '- correct：回答是否正确 / 合格；',
      '- feedback：简洁的反馈（亮点 + 不足 + 正确方向）；',
      '- level：advance（答对推进难度）/ stay（部分对维持）/ downgrade（答错降级到前置知识）。',
    ].join('\n'),
  });
  return object;
}
