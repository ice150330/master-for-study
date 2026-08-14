import { NotesView } from '@/components/notes/NotesView';
import { listNoteSources, listNoteVersions, listNotes, listSessions, listTerms } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染，不做静态预渲染。
export const dynamic = 'force-dynamic';

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedNoteId = typeof query.note === 'string' ? query.note : undefined;
  const notes = listNotes().map((n) => ({
    id: n.id,
    sessionId: n.sessionId,
    title: n.title,
    content: n.content,
    aiSnapshot: n.aiSnapshot,
    userContent: n.userContent,
    tags: n.tags,
    version: n.version,
    markdown: n.markdown,
    createdAt: n.createdAt.toISOString(),
    updatedAt: (n.updatedAt ?? n.createdAt).toISOString(),
    versions: listNoteVersions(n.id).map((version) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
    })),
    sources: listNoteSources(n.id).map((source) => ({
      ...source,
      createdAt: source.createdAt.toISOString(),
    })),
  }));
  const sessions = listSessions().map((s) => ({
    id: s.id,
    parentId: s.parentId,
    title: s.title,
  }));

  return (
    <NotesView
      initialNotes={notes}
      initialSessions={sessions}
      initialTerms={listTerms()}
      initialSelectedId={requestedNoteId}
    />
  );
}
