import { getKnowledgeGraph, getSessionKnowledgeGraph, saveKnowledgeNodeLayout } from '@/lib/db';
import { apiError, parseJson, withApiErrors } from '@/lib/validation/api';
import { knowledgeGraphQuerySchema, knowledgeLayoutSchema } from '@/lib/validation/schemas';

export async function GET(req: Request) {
  return withApiErrors(() => {
    const url = new URL(req.url);
    const parsed = knowledgeGraphQuerySchema.safeParse({
      mode: url.searchParams.get('mode') ?? undefined,
      centerId: url.searchParams.get('center') ?? undefined,
      depth: url.searchParams.get('depth') ?? undefined,
      relations: url.searchParams.getAll('relation'),
    });
    if (!parsed.success) return apiError('VALIDATION_ERROR', '知识图查询参数无效', 400);
    if (parsed.data.mode === 'session') return Response.json({ graph: getSessionKnowledgeGraph() });
    return Response.json({
      graph: getKnowledgeGraph({
        centerId: parsed.data.centerId,
        depth: parsed.data.depth,
        relations: parsed.data.relations,
      }),
    });
  });
}

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, knowledgeLayoutSchema);
    if (!parsed.success) return parsed.response;
    if (!saveKnowledgeNodeLayout(parsed.data)) {
      return apiError('KNOWLEDGE_NODE_NOT_FOUND', '知识节点不存在', 404);
    }
    return Response.json({ ok: true });
  });
}
