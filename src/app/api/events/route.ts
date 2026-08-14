import { recordEvent } from '@/lib/db';

/**
 * 通用学习事件写入接口（实践区等客户端行为落库，兑现「实践写进记忆」）。
 *
 * POST /api/events —— body: { type: string, metadata?: Record<string, unknown> }
 */

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.type) {
    return Response.json({ error: '缺少 type' }, { status: 400 });
  }

  recordEvent({ type: body.type, metadata: body.metadata });
  return Response.json({ ok: true }, { status: 201 });
}
