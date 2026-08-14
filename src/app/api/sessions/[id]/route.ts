import { getSession, listMessages } from '@/lib/db';
import { apiError, withApiErrors } from '@/lib/validation/api';
import { sessionIdSchema } from '@/lib/validation/schemas';

/**
 * 会话详情接口。
 *
 * GET /api/sessions/[id] —— 返回 { session, messages }（会话 + 历史消息）。
 */

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/sessions/[id]'>,
) {
  return withApiErrors(async () => {
    const params = await ctx.params;
    const parsedId = sessionIdSchema.safeParse(params.id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', '会话 ID 无效', 400);
    const session = getSession(parsedId.data);
    if (!session) return apiError('SESSION_NOT_FOUND', '会话不存在', 404);
    return Response.json({ session, messages: listMessages(parsedId.data) });
  });
}
