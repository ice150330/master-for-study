import { generateObject } from 'ai';
import { z } from 'zod';
import { fastModel } from './provider';

/**
 * 术语标注「两段式」：
 *   第一段（流式正文）—— 用 [[术语]] 内联标记，规避流式下结构化 JSON 的偏移错位；
 *   第二段（结构化清单）—— 用 generateObject 二次提取 [{ name, definition }]。
 */

/** 让正文流式返回时内联包裹技术名词的系统提示。 */
export const TERM_ANNOTATION_SYSTEM_PROMPT = [
  '你是一位本地 AI 学习老师。',
  '回答时，把正文中出现的【技术术语 / 专有名词 / 关键概念】用双方括号包裹，',
  '格式为 [[术语]]，其余文字保持自然通顺，不要额外解释标记本身。',
  '只标记真正需要解释的名词，常见日常词不要标记。',
].join('\n');

/** 结构化术语清单的 schema（zod v4）。 */
const TermListSchema = z.object({
  terms: z.array(
    z.object({
      name: z.string().describe('术语名称'),
      definition: z.string().describe('一句话中文解释'),
    }),
  ),
});

export type AnnotatedTerm = z.infer<typeof TermListSchema>['terms'][number];

/** 从一段正文中二次提取术语结构化清单（名称 + 一句话解释）。 */
export async function extractTerms(text: string): Promise<AnnotatedTerm[]> {
  const { object } = await generateObject({
    model: fastModel,
    schema: TermListSchema,
    schemaName: 'TermList',
    schemaDescription: '正文中出现的、需要解释的技术术语及其一句话中文解释',
    prompt: [
      '从下面的正文中提取所有技术术语 / 专有名词，',
      '并为每个术语写一句通俗的中文解释。',
      '只输出正文中实际出现过的术语，不要臆造。',
      '',
      '正文：',
      text,
    ].join('\n'),
  });

  return object.terms;
}
