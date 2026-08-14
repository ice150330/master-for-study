import { extractTerms } from '@/lib/ai/term-annotation';
import { upsertTerm } from '@/lib/db';
import { parseJson, withApiErrors } from '@/lib/validation/api';
import { termsRequestSchema } from '@/lib/validation/schemas';

/**
 * 术语结构化提取接口（术语标注「第二段」）。
 *
 * 请求体：{ text: string }
 * 响应：{ terms: Array<{ name: string; definition: string }> }
 * 附带：术语写入单源术语表（已存在则忽略），并记录 term_seen 事件。
 */

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, termsRequestSchema);
    if (!parsed.success) return parsed.response;
    if (!parsed.data.text.trim()) return Response.json({ terms: [] });

    const terms = await extractTerms(parsed.data.text);
    for (const [index, term] of terms.entries()) {
      upsertTerm({
        name: term.name,
        definition: term.definition,
        idempotencyKey: `${parsed.data.idempotencyKey}:term:${index}`,
      });
    }
    return Response.json({ terms });
  });
}
