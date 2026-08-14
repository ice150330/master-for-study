import { generateObject } from 'ai';
import { z } from 'zod';
import { proModel } from './provider';

/**
 * 学习笔记总结：把一段对话沉淀成结构化笔记（核心概念 / 术语表 / 代码示例 / 未懂点）。
 * 笔记是「重任务」，用 proModel（deepseek-v4-pro）。
 */

const NoteSchema = z.object({
  title: z.string().describe('笔记标题'),
  coreConcepts: z
    .array(z.object({ name: z.string(), explanation: z.string() }))
    .describe('核心概念列表'),
  terms: z
    .array(z.object({ name: z.string(), definition: z.string() }))
    .describe('术语表'),
  codeExamples: z
    .array(z.object({ label: z.string(), code: z.string() }))
    .describe('代码示例，没有则为空数组'),
  gaps: z
    .array(z.string())
    .describe('对话中用户还没弄懂、值得复习的点，没有则为空数组'),
});

export type GeneratedNote = z.infer<typeof NoteSchema>;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** 由对话历史生成结构化学习笔记。 */
export async function generateNote(messages: ChatMessage[]): Promise<GeneratedNote> {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? '用户' : '老师'}：${m.content}`)
    .join('\n\n');

  const { object } = await generateObject({
    model: proModel,
    schema: NoteSchema,
    schemaName: 'StudyNote',
    schemaDescription: '一段学习对话的结构化笔记总结',
    prompt: [
      '下面是用户与 AI 学习老师的一段对话。请把它总结成一份结构化学习笔记：',
      '- coreConcepts：这段对话讲到的核心概念，每个配一句通俗解释；',
      '- terms：涉及的技术术语及一句话定义；',
      '- codeExamples：对话中出现的代码 / 可运行示例（没有就返回空数组）；',
      '- gaps：用户还没完全弄懂、需要回头复习的点（没有就返回空数组）。',
      '只基于对话内容，不要臆造。',
      '',
      '对话：',
      transcript,
    ].join('\n'),
  });

  return object;
}

/** 把结构化笔记渲染成 Markdown（用于导出 / 回看）。 */
export function noteToMarkdown(note: GeneratedNote): string {
  const lines: string[] = [`# ${note.title}`, ''];

  if (note.coreConcepts.length) {
    lines.push('## 核心概念', '');
    for (const c of note.coreConcepts) lines.push(`- **${c.name}**：${c.explanation}`);
    lines.push('');
  }

  if (note.terms.length) {
    lines.push('## 术语表', '');
    for (const t of note.terms) lines.push(`- **${t.name}**：${t.definition}`);
    lines.push('');
  }

  if (note.codeExamples.length) {
    lines.push('## 代码示例', '');
    for (const e of note.codeExamples) {
      lines.push(`### ${e.label}`, '');
      lines.push('```', e.code, '```', '');
    }
  }

  if (note.gaps.length) {
    lines.push('## 我还未懂的点', '');
    for (const g of note.gaps) lines.push(`- ${g}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
