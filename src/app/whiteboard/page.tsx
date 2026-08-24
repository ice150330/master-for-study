import { WhiteboardView } from '@/components/whiteboard/WhiteboardView';
import { getKnowledgeGraph, getSessionKnowledgeGraph, getWorkspaceSettings } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function WhiteboardPage() {
  return (
    <WhiteboardView
      initialKnowledgeGraph={serializeGraph(getKnowledgeGraph({ depth: 1 }))}
      initialSessionGraph={serializeGraph(getSessionKnowledgeGraph())}
      growthGoal={getWorkspaceSettings().growthGoal}
    />
  );
}

function serializeGraph<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
