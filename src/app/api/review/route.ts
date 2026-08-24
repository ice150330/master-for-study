import {
  ReviewUndoConflictError,
  deferReviewCard,
  getReviewQueue,
  getTerm,
  listPendingQueueTerms,
  reviewTerm,
  setReviewCardDifficult,
  setTermQueueStatus,
  undoReview,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { reviewRequestSchema } from '@/lib/validation/schemas';

/**
 * 隐性巩固（间隔重复复习）接口。
 *
 * GET  /api/review —— 返回到期待复习的术语队列 + 待确认概念清单（A2 队列治理）
 * POST /api/review —— review 评级、undo 撤销、flag 困难卡标记、
 *                     queue 队列状态流转（确认入队/移出/恢复）、defer 跳过或降频。
 */

export async function GET() {
  return withApiErrors(() =>
    Response.json({ ...getReviewQueue(), pending: listPendingQueueTerms() }),
  );
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
    if (parsed.data.action === 'queue') {
      setTermQueueStatus(parsed.data.termId, parsed.data.queueStatus);
      return Response.json({ queue: { termId: parsed.data.termId, queueStatus: parsed.data.queueStatus } });
    }
    if (parsed.data.action === 'defer') {
      deferReviewCard(parsed.data.termId, parsed.data.days);
      return Response.json({ deferred: { termId: parsed.data.termId, days: parsed.data.days } });
    }
    return Response.json({ next: reviewTerm(parsed.data) });
  });
}
