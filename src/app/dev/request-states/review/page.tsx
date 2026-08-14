import { notFound } from 'next/navigation';
import { ReviewView } from '@/components/review/ReviewView';

const preview = {
  again: { dueAt: '2026-08-15T08:01:00.000Z', intervalMs: 60_000, intervalLabel: '1 分钟', scheduledDays: 0 },
  hard: { dueAt: '2026-08-15T08:06:00.000Z', intervalMs: 360_000, intervalLabel: '6 分钟', scheduledDays: 0 },
  good: { dueAt: '2026-08-15T08:10:00.000Z', intervalMs: 600_000, intervalLabel: '10 分钟', scheduledDays: 0 },
  easy: { dueAt: '2026-08-16T08:00:00.000Z', intervalMs: 86_400_000, intervalLabel: '1 天', scheduledDays: 1 },
};

export default function ReviewRequestStatePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <ReviewView
      initialQueue={{
        reviews: [{
          cardId: 'review-state-card',
          termId: 'review-state-term',
          name: '幂等性',
          definition: '同一个操作重复执行多次，产生的业务结果与执行一次相同。',
          state: 'learning',
          stability: 2.4,
          difficulty: 5,
          dueAt: '2026-08-14T08:00:00.000Z',
          isDifficult: false,
          sourceLabel: '来源：事务设计',
          sourceHref: '/?concept=review-state-term',
          preview,
        }],
        summary: { due: 1, overdue: 1, estimatedMinutes: 1 },
      }}
    />
  );
}
