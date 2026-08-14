import { getConceptDetail } from '@/lib/db';
import { apiError, withApiErrors } from '@/lib/validation/api';
import { conceptLookupSchema } from '@/lib/validation/schemas';

/** 按统一 id 或任一名称读取跨模块共享的 Concept 详情。 */
export async function GET(req: Request) {
  return withApiErrors(() => {
    const url = new URL(req.url);
    const parsed = conceptLookupSchema.safeParse({
      id: url.searchParams.get('id') ?? undefined,
      name: url.searchParams.get('name') ?? undefined,
    });
    if (!parsed.success) return apiError('VALIDATION_ERROR', 'Concept 查询参数无效', 400);
    const detail = getConceptDetail(parsed.data);
    if (!detail) return apiError('CONCEPT_NOT_FOUND', 'Concept 不存在', 404);
    return Response.json(detail);
  });
}
