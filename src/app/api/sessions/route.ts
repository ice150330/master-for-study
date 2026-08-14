import { createSession, getSession, listSessions } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { sessionsCreateSchema } from '@/lib/validation/schemas';

/**
 * 会话管理接口。
 *
 * GET  /api/sessions             —— 列出全部会话（前端按 parent_id 组装树）
 * POST /api/sessions             —— 新建 / 派生会话
 *    body: { parentId?: string|null, title?: string, idempotencyKey: string }
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
    const session = createSession(parsed.data);
    return Response.json({ session }, { status: 201 });
  });
}
