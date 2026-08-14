import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { analyticsFixture } from '../fixture';

export default function EmptyAnalyticsFixturePage() {
  return <AnalyticsView initialData={analyticsFixture('empty')} />;
}
