'use client';

import Link from 'next/link';
import { useState } from 'react';

type NoteContent = {
  coreConcepts: { name: string; explanation: string }[];
  terms: { name: string; definition: string }[];
  codeExamples: { label: string; code: string }[];
  gaps: string[];
};

type Note = {
  id: string;
  sessionId: string | null;
  title: string;
  content: Record<string, unknown>;
  markdown: string;
  createdAt: string;
};

type Session = { id: string; parentId: string | null; title: string };

export function NotesView({
  initialNotes,
  initialSessions,
}: {
  initialNotes: Note[];
  initialSessions: Session[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? '');
  const [generating, setGenerating] = useState(false);

  async function loadNotes() {
    const res = await fetch('/api/notes');
    if (res.ok) setNotes(((await res.json()) as { notes: Note[] }).notes);
  }

  async function generate() {
    if (!selectedId || generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedId }),
      });
      if (res.ok) await loadNotes();
      else alert('生成失败：请确认该会话有消息，且 DeepSeek key 有效');
    } finally {
      setGenerating(false);
    }
  }

  function exportMarkdown(note: Note) {
    const blob = new Blob([note.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">学习笔记</h1>
          <p className="mt-1 text-sm text-muted">把对话沉淀成结构化笔记，可导出 Markdown</p>
        </div>
        <Link href="/" className="rounded-lg bg-card px-3 py-2 text-sm text-background">
          ← 返回聊天
        </Link>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-background outline-none focus:border-primary"
        >
          {initialSessions.length === 0 && <option value="">（暂无会话）</option>}
          {initialSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={!selectedId || generating}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          {generating ? '生成中…' : '生成笔记'}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          还没有笔记，选一个会话点「生成笔记」试试
        </p>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onExport={() => exportMarkdown(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onExport }: { note: Note; onExport: () => void }) {
  const content = note.content as unknown as NoteContent;

  return (
    <article className="rounded-2xl bg-card p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-background">{note.title}</h2>
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-background"
        >
          导出 Markdown
        </button>
      </div>

      {content.coreConcepts?.length > 0 && (
        <Section title="核心概念">
          {content.coreConcepts.map((c, i) => (
            <p key={i} className="text-sm leading-relaxed text-background/80">
              <span className="font-medium text-background">{c.name}</span>：{c.explanation}
            </p>
          ))}
        </Section>
      )}

      {content.terms?.length > 0 && (
        <Section title="术语表">
          {content.terms.map((t, i) => (
            <p key={i} className="text-sm leading-relaxed text-background/80">
              <span className="font-medium text-background">{t.name}</span>：{t.definition}
            </p>
          ))}
        </Section>
      )}

      {content.codeExamples?.length > 0 && (
        <Section title="代码示例">
          {content.codeExamples.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="mb-1 text-xs font-medium text-background/60">{e.label}</div>
              <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
                {e.code}
              </pre>
            </div>
          ))}
        </Section>
      )}

      {content.gaps?.length > 0 && (
        <Section title="我还未懂的点">
          {content.gaps.map((g, i) => (
            <p key={i} className="text-sm leading-relaxed text-background/80">
              • {g}
            </p>
          ))}
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="mb-1.5 text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
