import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import {
  getEventBreakdown,
  getInterviewStats,
  getRecentEvents,
  getTermStats,
} from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
  const data = {
    termStats: getTermStats(),
    eventBreakdown: getEventBreakdown(),
    interviewStats: getInterviewStats(),
    recentEvents: getRecentEvents(15).map((e) => ({
      type: e.type,
      entityId: e.entityId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  };

  return <AnalyticsView data={data} />;
}
