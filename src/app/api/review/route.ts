import { getDueReviews, reviewTerm } from '@/lib/db';
import type { ReviewGrade } from '@/lib/fsrs';

/**
 * 隐性巩固（间隔重复复习）接口。
 *
 * GET  /api/review —— 返回到期待复习的术语队列
 * POST /api/review —— 复习一个术语
 *    body: { termId: string, grade: 'again'|'hard'|'good'|'easy' }
 */

export async function GET() {
  const reviews = getDueReviews();
  return Response.json({ reviews });
}

export async function POST(req: Request) {
  const { termId, grade } = (await req.json()) as {
    termId?: string;
    grade?: ReviewGrade;
  };

  if (!termId || !grade) {
    return Response.json({ error: '缺少 termId 或 grade' }, { status: 400 });
  }

  const next = reviewTerm(termId, grade);
  return Response.json({ next });
}
