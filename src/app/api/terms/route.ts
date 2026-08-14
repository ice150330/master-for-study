import { extractTerms } from '@/lib/ai/term-annotation';
import { findMessageByIdempotencyKey, recordConceptMention, upsertTerm } from '@/lib/db';
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
    const sourceMessage = parsed.data.sourceMessageIdempotencyKey
      ? findMessageByIdempotencyKey(parsed.data.sourceMessageIdempotencyKey)
      : undefined;
    const concepts = terms.map((term, index) => {
      const concept = upsertTerm({
        name: term.name,
        canonicalName: term.canonicalName,
        aliases: term.aliases,
        definition: term.definition,
        example: term.example,
        confidence: term.confidence,
        idempotencyKey: `${parsed.data.idempotencyKey}:term:${index}`,
      });
      if (sourceMessage) {
        recordConceptMention({
          termId: concept.id,
          sourceType: 'message',
          sourceId: sourceMessage.id,
          sessionId: sourceMessage.sessionId,
          locator: `message:${sourceMessage.id}`,
          excerpt: parsed.data.text.slice(0, 280),
          idempotencyKey: `${parsed.data.idempotencyKey}:mention:${index}`,
        });
      }
      return concept;
    });
    return Response.json({ terms: concepts });
  });
}
