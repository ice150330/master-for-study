import {
  ReviewUndoConflictError,
  getReviewQueue,
  getTerm,
  reviewTerm,
  setReviewCardDifficult,
  undoReview,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { reviewRequestSchema } from '@/lib/validation/schemas';

/**
 * 隐性巩固（间隔重复复习）接口。
 *
 * GET  /api/review —— 返回到期待复习的术语队列
 * POST /api/review —— review 评级、undo 撤销或 flag 困难卡标记。
 */

export async function GET() {
  return withApiErrors(() => Response.json(getReviewQueue()));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, reviewRequestSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.action === 'undo') {
      try {
        return Response.json({ undo: undoReview(parsed.data) });
      } catch (error) {
        if (error instanceof ReviewUndoConflictError) {
          throw new DomainError('REVIEW_UNDO_CONFLICT', error.message, 409);
        }
        throw error;
      }
    }
    if (!getTerm(parsed.data.termId)) {
      throw new DomainError('TERM_NOT_FOUND', '术语不存在', 404);
    }
    if (parsed.data.action === 'flag') {
      return Response.json({ card: setReviewCardDifficult(parsed.data) });
    }
    return Response.json({ next: reviewTerm(parsed.data) });
  });
}
