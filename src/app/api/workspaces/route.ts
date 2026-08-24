import { ensureWorkspace, listWorkspaces, createWorkspace } from '@/lib/db';
import { parseJson, withApiErrors } from '@/lib/validation/api';
import { workspaceCreateSchema } from '@/lib/validation/schemas';

/**
 * 工作区接口（蓝图 4.1：一个工作区 = 一个学习主题）。
 *
 * GET  /api/workspaces → { workspaces, activeId }（激活的排最前）
 * POST /api/workspaces { title, goal? } → 新建并立即激活 → 201 { workspace }
 */

export async function GET() {
  return withApiErrors(() => {
    ensureWorkspace(); // 首次访问时落默认工作区
    const workspaces = listWorkspaces();
    return Response.json({
      workspaces: workspaces.map(serializeWorkspace),
      activeId: workspaces.find((workspace) => workspace.isActive)?.id ?? null,
    });
  });
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, workspaceCreateSchema);
    if (!parsed.success) return parsed.response;
    return Response.json({ workspace: serializeWorkspace(createWorkspace(parsed.data)) }, { status: 201 });
  });
}

function serializeWorkspace(workspace: ReturnType<typeof ensureWorkspace>) {
  return { ...workspace, createdAt: workspace.createdAt.toISOString() };
}
