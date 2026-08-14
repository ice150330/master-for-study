import { createSession, getMessage, getSession, listSessions } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { sessionsCreateSchema } from '@/lib/validation/schemas';

/**
 * 会话管理接口。
 *
 * GET  /api/sessions             —— 列出全部会话（前端按 parent_id 组装树）
 * POST /api/sessions             —— 新建 / 派生会话
 *    根会话 body: { title?: string, idempotencyKey: string }
 *    分支 body: { forkedFromMessageId: string, title?: string, idempotencyKey: string }
 */

export async function GET() {
  return withApiErrors(() =>
    Response.json({
      sessions: listSessions(),
      archivedSessions: listSessions({ archived: true }),
    }),
  );
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, sessionsCreateSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.parentId && !getSession(parsed.data.parentId)) {
      throw new DomainError('PARENT_SESSION_NOT_FOUND', '父会话不存在', 404);
    }
    let { parentId } = parsed.data;
    const { forkedFromMessageId } = parsed.data;
    if (forkedFromMessageId) {
      const anchor = getMessage(forkedFromMessageId);
      if (!anchor) {
        throw new DomainError('FORK_ANCHOR_NOT_FOUND', '分支锚点不存在', 404);
      }
      if (parentId && parentId !== anchor.sessionId) {
        throw new DomainError('INVALID_FORK_ANCHOR', '分支锚点不属于父会话', 400);
      }
      parentId = anchor.sessionId;
    }
    const session = createSession({ ...parsed.data, parentId });
    return Response.json({ session }, { status: 201 });
  });
}
