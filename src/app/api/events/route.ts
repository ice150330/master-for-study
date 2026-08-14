import { recordEvent } from '@/lib/db';
import { parseJson, withApiErrors } from '@/lib/validation/api';
import { publicEventSchema } from '@/lib/validation/schemas';

/**
 * 通用学习事件写入接口（实践区等客户端行为落库，兑现「实践写进记忆」）。
 *
 * POST /api/events —— 仅接受公开 action 白名单和幂等键。
 */

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, publicEventSchema);
    if (!parsed.success) return parsed.response;
    const event = recordEvent({
      action: parsed.data.action,
      objectType: 'practice',
      result: parsed.data.result,
      context: parsed.data.context,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return Response.json({ event }, { status: 201 });
  });
}
