import Link from 'next/link';
import { TreeGraph } from '@/components/whiteboard/TreeGraph';
import { getAllMasteries, listSessions, type Session } from '@/lib/db';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import { layoutTree, type TreeInput } from '@/lib/tree-layout';
import { BACKEND_SKILL_TREE, stateToStyle, type SkillData } from '@/lib/skill-tree';

// 本地 SQLite 数据，每次请求实时渲染。
export const dynamic = 'force-dynamic';

export default function WhiteboardPage() {
  // 会话关系图
  const sessions = listSessions();
  const roots = buildSessionTree(sessions);
  const sessionTree: TreeInput = {
    id: 'workspace',
    label: '工作区',
    children: roots.map(toSessionNode),
  };
  const sessionLayout = layoutTree(sessionTree);

  // 成长地图（用术语掌握度上热力色）
  const mastery = new Map(getAllMasteries().map((m) => [m.name, m.state]));
  const skillTree = decorate(BACKEND_SKILL_TREE, mastery);
  const skillLayout = layoutTree(skillTree);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">白板</h1>
          <p className="mt-1 text-sm text-muted">一板两用：会话关系图 + 个人成长地图</p>
        </div>
        <Link href="/" className="rounded-lg bg-card px-3 py-2 text-sm text-background">
          ← 返回聊天
        </Link>
      </header>

      <section className="mb-8 rounded-2xl bg-background/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">会话关系图</h2>
        {sessions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            还没有会话，去聊几句再来看看关系树
          </p>
        ) : (
          <TreeGraph layout={sessionLayout} />
        )}
      </section>

      <section className="rounded-2xl bg-background/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">个人成长地图</h2>
        <p className="mb-4 text-xs text-muted">
          青色=已掌握 · 黄色=学习中 · 粉色=重学中 · 紫色=新发现 · 灰色=未接触
        </p>
        <TreeGraph layout={skillLayout} nodeStyle={(n) => stateToStyle(n.data?.state)} />
      </section>
    </div>
  );
}

function toSessionNode(s: SessionTreeNode<Session>): TreeInput {
  return { id: s.id, label: s.title, children: s.children.map(toSessionNode) };
}

function decorate(node: TreeInput<SkillData>, mastery: Map<string, string>): TreeInput<SkillData> {
  return {
    ...node,
    data: node.data?.term ? { ...node.data, state: mastery.get(node.data.term) } : node.data,
    children: node.children.map((c) => decorate(c, mastery)),
  };
}
