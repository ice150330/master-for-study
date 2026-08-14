import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { getLearningAnalytics } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
  return <AnalyticsView initialData={getLearningAnalytics(7)} />;
}
