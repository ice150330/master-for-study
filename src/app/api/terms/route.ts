import { extractTerms } from '@/lib/ai/term-annotation';

/**
 * 术语结构化提取接口（术语标注「第二段」）。
 *
 * 请求体：{ text: string }
 * 响应：{ terms: Array<{ name: string; definition: string }> }
 */

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };

  if (!text || !text.trim()) {
    return Response.json({ terms: [] });
  }

  const terms = await extractTerms(text);
  return Response.json({ terms });
}
