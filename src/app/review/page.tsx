import { ReviewView } from '@/components/review/ReviewView';
import { getReviewLog, getReviewQueue, getTerm } from '@/lib/db';
import { parseLearningContext } from '@/lib/learning-context';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.attempt) search.set('attempt', params.attempt);
  const context = parseLearningContext(search);
  const log = context.attempt?.type === 'review' ? getReviewLog(context.attempt.id) : undefined;
  const term = log ? getTerm(log.termId) : undefined;
  return (
    <ReviewView
      initialQueue={getReviewQueue()}
      focusReview={log ? {
        id: log.id,
        termId: log.termId,
        termName: term?.canonicalName || term?.name || '复习概念',
        rating: log.rating,
        reviewAt: log.reviewAt.toISOString(),
        scheduledDays: log.scheduledDaysAfter,
      } : null}
    />
  );
}
