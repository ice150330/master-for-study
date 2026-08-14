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
      canonicalName: z.string().describe('统一、无歧义的规范名称'),
      aliases: z.array(z.string()).max(6).describe('正文中可能出现的别名或缩写'),
      definition: z.string().describe('一句话中文解释'),
      example: z.string().describe('贴近正文上下文的一句话示例'),
      confidence: z.number().min(0).max(1).describe('提取置信度，0 到 1'),
    }),
  ),
});

export type AnnotatedTerm = z.infer<typeof TermListSchema>['terms'][number];

/** 从一段正文中二次提取 Concept 结构化清单。 */
export async function extractTerms(text: string): Promise<AnnotatedTerm[]> {
  const { object } = await generateObject({
    model: fastModel,
    schema: TermListSchema,
    schemaName: 'TermList',
    schemaDescription: '正文中出现的、需要解释的技术术语及其一句话中文解释',
    prompt: [
      '从下面的正文中提取所有技术术语 / 专有名词，',
      '为每个术语给出规范名、正文别名、一句话中文解释、上下文示例和置信度。',
      '只输出正文中实际出现过的术语，不要臆造。',
      '',
      '正文：',
      text,
    ].join('\n'),
  });

  return object.terms;
}
