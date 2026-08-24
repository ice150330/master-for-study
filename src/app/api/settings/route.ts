import { getWorkspaceSettings, updateWorkspaceSettings } from '@/lib/db';
import { parseJson, withApiErrors } from '@/lib/validation/api';
import { settingsPatchSchema } from '@/lib/validation/schemas';

/**
 * 工作区设置接口（老师风格与可配置项的单一存储点）。
 *
 * GET  /api/settings → { settings }（首次访问自动落默认行）
 * PATCH /api/settings 部分更新 → { settings }
 * 设置变更不是学习行为，不写事件流、不带幂等键（last-write-wins）。
 */

export async function GET() {
  return withApiErrors(() => {
    return Response.json({ settings: serializeSettings(getWorkspaceSettings()) });
  });
}

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, settingsPatchSchema);
    if (!parsed.success) return parsed.response;
    return Response.json({ settings: serializeSettings(updateWorkspaceSettings(parsed.data)) });
  });
}

function serializeSettings(settings: ReturnType<typeof getWorkspaceSettings>) {
  return { ...settings, updatedAt: settings.updatedAt.toISOString() };
}
