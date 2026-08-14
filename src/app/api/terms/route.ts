import { extractTerms } from '@/lib/ai/term-annotation';
import { recordEvent, upsertTerm } from '@/lib/db';

/**
 * 术语结构化提取接口（术语标注「第二段」）。
 *
 * 请求体：{ text: string }
 * 响应：{ terms: Array<{ name: string; definition: string }> }
 * 附带：术语写入单源术语表（已存在则忽略），并记录 term_seen 事件。
 */

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };

  if (!text || !text.trim()) {
    return Response.json({ terms: [] });
  }

  const terms = await extractTerms(text);

  for (const t of terms) {
    upsertTerm({ name: t.name, definition: t.definition });
    recordEvent({ type: 'term_seen', metadata: { term: t.name } });
  }

  return Response.json({ terms });
}
