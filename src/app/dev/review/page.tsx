import { notFound } from 'next/navigation';
import { ReviewView } from '@/components/review/ReviewView';

const preview = {
  again: { dueAt: '2026-08-15T08:01:00.000Z', intervalMs: 60_000, intervalLabel: '1 分钟', scheduledDays: 0 },
  hard: { dueAt: '2026-08-15T08:06:00.000Z', intervalMs: 360_000, intervalLabel: '6 分钟', scheduledDays: 0 },
  good: { dueAt: '2026-08-18T08:00:00.000Z', intervalMs: 259_200_000, intervalLabel: '3 天', scheduledDays: 3 },
  easy: { dueAt: '2026-08-23T08:00:00.000Z', intervalMs: 691_200_000, intervalLabel: '8 天', scheduledDays: 8 },
};

const reviews = [
  {
    cardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    termId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: '缓存一致性',
    definition: '缓存中的数据与权威数据源在可接受时间窗口内保持一致。常见策略包括失效、更新与版本校验。',
    state: 'reviewing' as const,
    stability: 6.8,
    difficulty: 4.3,
    dueAt: '2026-08-13T08:00:00.000Z',
    isDifficult: false,
    sourceLabel: '来源：HTTP 缓存策略',
    sourceHref: '/?session=cccccccc-cccc-4ccc-8ccc-cccccccccccc&message=dddddddd-dddd-4ddd-8ddd-dddddddddddd&concept=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    preview,
  },
  {
    cardId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    termId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    name: 'ETag',
    definition: 'HTTP 响应的实体标签，客户端可在条件请求中用它判断资源表示是否发生变化。',
    state: 'learning' as const,
    stability: 2.1,
    difficulty: 6.2,
    dueAt: '2026-08-15T07:30:00.000Z',
    isDifficult: true,
    sourceLabel: '来源：条件请求',
    sourceHref: '/?concept=ffffffff-ffff-4fff-8fff-ffffffffffff',
    preview,
  },
];

export default function ReviewDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ReviewView initialQueue={{ reviews, summary: { due: 2, overdue: 1, estimatedMinutes: 2 } }} />;
}
