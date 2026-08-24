import { getTerm, updateTermDefinition } from '@/lib/db';
import { apiError, parseJson, withApiErrors } from '@/lib/validation/api';
import { conceptUpdateSchema, workspaceIdSchema } from '@/lib/validation/schemas';

/**
 * Concept 编辑接口（B2 定义修正）。
 *
 * PATCH /api/concepts/[id] { definition } → { concept }
 * 术语是单源对象：定义修正后复习卡、知识图与概念轨道经动态 join 自动联动。
 */

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/concepts/[id]'>,
) {
  return withApiErrors(async () => {
    const params = await ctx.params;
    const parsedId = workspaceIdSchema.safeParse(params.id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', 'Concept ID 无效', 400);
    const parsed = await parseJson(req, conceptUpdateSchema);
    if (!parsed.success) return parsed.response;
    const updated = updateTermDefinition(parsedId.data, parsed.data.definition);
    if (!updated) return apiError('CONCEPT_NOT_FOUND', 'Concept 不存在', 404);
    return Response.json({
      concept: {
        id: updated.id,
        name: updated.name,
        canonicalName: updated.canonicalName,
        definition: updated.definition,
      },
    });
  });
}

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/concepts/[id]'>,
) {
  return withApiErrors(async () => {
    const params = await ctx.params;
    const parsedId = workspaceIdSchema.safeParse(params.id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', 'Concept ID 无效', 400);
    const term = getTerm(parsedId.data);
    if (!term) return apiError('CONCEPT_NOT_FOUND', 'Concept 不存在', 404);
    return Response.json({ concept: term });
  });
}
