import { renameWorkspace, switchWorkspace } from '@/lib/db';
import { apiError, parseJson, withApiErrors } from '@/lib/validation/api';
import { workspaceIdSchema, workspaceUpdateSchema } from '@/lib/validation/schemas';

/**
 * 工作区编辑接口。
 *
 * PATCH /api/workspaces/[id] { title?, goal?, activate? } → { workspace }
 * activate=true 即切换当前工作区（事务保证至多一个激活）。
 */

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/workspaces/[id]'>,
) {
  return withApiErrors(async () => {
    const params = await ctx.params;
    const parsedId = workspaceIdSchema.safeParse(params.id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', '工作区 ID 无效', 400);
    const parsed = await parseJson(req, workspaceUpdateSchema);
    if (!parsed.success) return parsed.response;

    const { title, goal, activate } = parsed.data;
    if (activate && !switchWorkspace(parsedId.data)) {
      return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
    }
    if (title !== undefined || goal !== undefined) {
      if (!renameWorkspace(parsedId.data, { title, goal })) {
        return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
      }
    }
    // 空补丁 = 仅回读当前行（也可校验工作区存在）
    const workspace = renameWorkspace(parsedId.data, {});
    if (!workspace) return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
    return Response.json({
      workspace: { ...workspace, createdAt: workspace.createdAt.toISOString() },
    });
  });
}
