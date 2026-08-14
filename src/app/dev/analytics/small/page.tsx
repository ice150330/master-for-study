import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { analyticsFixture } from '../fixture';

export default function SmallAnalyticsFixturePage() {
  return <AnalyticsView initialData={analyticsFixture('small')} />;
}
