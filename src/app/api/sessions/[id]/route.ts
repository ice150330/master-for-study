import { getSession, listMessages } from '@/lib/db';

/**
 * 会话详情接口。
 *
 * GET /api/sessions/[id] —— 返回 { session, messages }（会话 + 历史消息）。
 */

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/sessions/[id]'>,
) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) {
    return Response.json({ error: '会话不存在' }, { status: 404 });
  }

  const messages = listMessages(id);
  return Response.json({ session, messages });
}
