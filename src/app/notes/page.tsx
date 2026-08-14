import { NotesView } from '@/components/notes/NotesView';
import { listNotes, listSessions } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染，不做静态预渲染。
export const dynamic = 'force-dynamic';

export default function NotesPage() {
  const notes = listNotes().map((n) => ({
    id: n.id,
    sessionId: n.sessionId,
    title: n.title,
    content: n.content,
    markdown: n.markdown,
    createdAt: n.createdAt.toISOString(),
  }));
  const sessions = listSessions().map((s) => ({
    id: s.id,
    parentId: s.parentId,
    title: s.title,
  }));

  return <NotesView initialNotes={notes} initialSessions={sessions} />;
}
