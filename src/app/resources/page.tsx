import { ResourcesView } from '@/components/resources/ResourcesView';
import { listResources, listTerms } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function ResourcesPage() {
  const resources = listResources().map((r) => ({
    id: r.id,
    termId: r.termId,
    title: r.title,
    type: r.type,
    url: r.url,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
  const terms = listTerms();

  return <ResourcesView initialResources={resources} initialTerms={terms} />;
}
