import { TodayView } from '@/components/today/TodayView';
import { getTodayLearningActions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function TodayPage() {
  return <TodayView initialActions={getTodayLearningActions()} />;
}
