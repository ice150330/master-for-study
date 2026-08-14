import { createSession, listSessions } from '@/lib/db';

/**
 * 会话管理接口。
 *
 * GET  /api/sessions             —— 列出全部会话（前端按 parent_id 组装树）
 * POST /api/sessions             —— 新建 / 派生会话
 *    body: { parentId?: string|null, title?: string }
 */

export async function GET() {
  const sessions = listSessions();
  return Response.json({ sessions });
}

export async function POST(req: Request) {
  const { parentId, title } = (await req.json()) as {
    parentId?: string | null;
    title?: string;
  };

  const session = createSession({ parentId, title });
  return Response.json({ session }, { status: 201 });
}
