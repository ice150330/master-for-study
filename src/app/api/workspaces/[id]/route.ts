import { deleteWorkspace, renameWorkspace, setWorkspaceArchived, switchWorkspace } from '@/lib/db';
import { apiError, DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { workspaceIdSchema, workspaceUpdateSchema } from '@/lib/validation/schemas';

/**
 * 工作区编辑接口。
 *
 * PATCH /api/workspaces/[id] { title?, goal?, activate?, archived? } → { workspace }
 * activate=true 即切换当前工作区；archived 为归档 / 恢复（当前工作区不可归档）。
 * DELETE /api/workspaces/[id] —— 删除工作区及其全部学习过程数据（当前工作区不可删）。
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

    const { title, goal, activate, archived } = parsed.data;
    if (activate && !switchWorkspace(parsedId.data)) {
      return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
    }
    if (title !== undefined || goal !== undefined) {
      if (!renameWorkspace(parsedId.data, { title, goal })) {
        return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
      }
    }
    if (archived !== undefined) {
      try {
        if (!setWorkspaceArchived(parsedId.data, archived)) {
          return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
        }
      } catch (error) {
        throw new DomainError(
          'WORKSPACE_ACTIVE_CONFLICT',
          error instanceof Error ? error.message : '工作区状态冲突',
          409,
        );
      }
    }
    // 空补丁 = 仅回读当前行（也可校验工作区存在）
    const workspace = renameWorkspace(parsedId.data, {});
    if (!workspace) return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
    return Response.json({
      workspace: {
        ...workspace,
        archivedAt: workspace.archivedAt?.toISOString() ?? null,
        createdAt: workspace.createdAt.toISOString(),
      },
    });
  });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/workspaces/[id]'>,
) {
  return withApiErrors(async () => {
    const params = await ctx.params;
    const parsedId = workspaceIdSchema.safeParse(params.id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', '工作区 ID 无效', 400);
    try {
      const result = deleteWorkspace(parsedId.data);
      if (!result.deleted) return apiError('WORKSPACE_NOT_FOUND', '工作区不存在', 404);
      return Response.json({ deleted: true });
    } catch (error) {
      throw new DomainError(
        'WORKSPACE_ACTIVE_CONFLICT',
        error instanceof Error ? error.message : '工作区状态冲突',
        409,
      );
    }
  });
}
