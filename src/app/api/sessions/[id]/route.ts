import {
  deleteSession,
  getSession,
  listHistoricalTerms,
  listMessagesWithResources,
  updateSession,
} from '@/lib/db';
import { apiError, parseJson, withApiErrors } from '@/lib/validation/api';
import {
  sessionDeleteSchema,
  sessionIdSchema,
  sessionUpdateSchema,
} from '@/lib/validation/schemas';

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
    const messages = listMessagesWithResources(parsedId.data);
    return Response.json({
      session,
      messages,
      terms: listHistoricalTerms(messages),
    });
  });
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/sessions/[id]'>) {
  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const parsedId = sessionIdSchema.safeParse(id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', '会话 ID 无效', 400);
    const parsed = await parseJson(req, sessionUpdateSchema);
    if (!parsed.success) return parsed.response;
    const session = updateSession(parsedId.data, parsed.data);
    if (!session) return apiError('SESSION_NOT_FOUND', '会话不存在', 404);
    return Response.json({ session });
  });
}

export async function DELETE(req: Request, ctx: RouteContext<'/api/sessions/[id]'>) {
  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const parsedId = sessionIdSchema.safeParse(id);
    if (!parsedId.success) return apiError('VALIDATION_ERROR', '会话 ID 无效', 400);
    const parsed = await parseJson(req, sessionDeleteSchema);
    if (!parsed.success) return parsed.response;
    if (!deleteSession(parsedId.data, parsed.data.idempotencyKey)) {
      return apiError('SESSION_NOT_FOUND', '会话不存在', 404);
    }
    return Response.json({ ok: true });
  });
}
