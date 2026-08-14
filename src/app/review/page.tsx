import { ReviewView } from '@/components/review/ReviewView';
import { getReviewQueue } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  return <ReviewView initialQueue={getReviewQueue()} />;
}
