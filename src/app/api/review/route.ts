import { getDueReviews, getTerm, reviewTerm } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { reviewRequestSchema } from '@/lib/validation/schemas';

/**
 * 隐性巩固（间隔重复复习）接口。
 *
 * GET  /api/review —— 返回到期待复习的术语队列
 * POST /api/review —— 复习一个术语
 *    body: { termId, grade: 'again'|'hard'|'good'|'easy', idempotencyKey }
 */

export async function GET() {
  return withApiErrors(() => Response.json({ reviews: getDueReviews() }));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, reviewRequestSchema);
    if (!parsed.success) return parsed.response;
    if (!getTerm(parsed.data.termId)) {
      throw new DomainError('TERM_NOT_FOUND', '术语不存在', 404);
    }
    return Response.json({ next: reviewTerm(parsed.data) });
  });
}
