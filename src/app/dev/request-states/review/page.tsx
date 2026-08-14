import { notFound } from 'next/navigation';
import { ReviewView } from '@/components/review/ReviewView';

export default function ReviewRequestStatePage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <ReviewView
      initialReviews={[
        {
          termId: 'review-state-term',
          name: '幂等性',
          definition: '同一个操作重复执行多次，产生的业务结果与执行一次相同。',
          state: 'review',
          stability: 2.4,
          difficulty: 5,
        },
      ]}
    />
  );
}
