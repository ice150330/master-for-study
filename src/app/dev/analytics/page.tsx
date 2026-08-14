import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { analyticsFixture } from './fixture';

export default function AnalyticsFixturePage() {
  return <AnalyticsView initialData={analyticsFixture('normal')} />;
}
