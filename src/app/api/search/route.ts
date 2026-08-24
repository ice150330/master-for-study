import { searchContent } from '@/lib/db';
import { apiError, withApiErrors } from '@/lib/validation/api';
import { z } from 'zod';

/**
 * 全局内容搜索接口（C1）：跨会话标题、消息正文、概念、笔记与资源。
 *
 * GET /api/search?q=关键词 → { hits: Array<{ type, id, title, excerpt, sessionId? }> }
 */

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export async function GET(req: Request) {
  return withApiErrors(() => {
    const url = new URL(req.url);
    const parsed = searchQuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
    if (!parsed.success) return apiError('VALIDATION_ERROR', '搜索词无效', 400);
    return Response.json({ hits: searchContent(parsed.data.q) });
  });
}
