'use client';

import {
  BookOpenCheck,
  Check,
  Copy,
  Download,
  History,
  Link2,
  Link2Off,
  ListTree,
  MessageSquareText,
  Pencil,
  Save,
  Search,
  SquareTerminal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';

type NoteVersion = {
  id: string;
  version: number;
  origin: 'ai' | 'user';
  title: string;
  markdown: string;
  tags: string[];
  createdAt: string;
};

type NoteSource = {
  id: string;
  sessionId: string | null;
  startMessageId: string | null;
  endMessageId: string | null;
  excerpt: string | null;
  valid: boolean;
  sessionTitle: string | null;
};

type Note = {
  id: string;
  sessionId: string | null;
  title: string;
  content: Record<string, unknown>;
  aiSnapshot: Record<string, unknown>;
  userContent: Record<string, unknown> | null;
  tags: string[];
  version: number;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  versions: NoteVersion[];
  sources: NoteSource[];
};

type Session = { id: string; parentId: string | null; title: string };

export function NotesView({
  initialNotes,
  initialSessions,
  initialTerms,
  initialSelectedId,
}: {
  initialNotes: Note[];
  initialSessions: Session[];
  initialTerms: Array<{ id: string; name: string }>;
  initialSelectedId?: string;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState(
    initialNotes.some((note) => note.id === initialSelectedId) ? initialSelectedId! : initialNotes[0]?.id ?? '',
  );
  const [sessionId, setSessionId] = useState(initialSessions[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('全部标签');
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMarkdown, setDraftMarkdown] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [versionOpen, setVersionOpen] = useState(false);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const allTags = useMemo(
    () => [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [notes],
  );
  const visibleNotes = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return notes.filter((note) => {
      const matchesQuery =
        !keyword ||
        note.title.toLocaleLowerCase().includes(keyword) ||
        note.markdown.toLocaleLowerCase().includes(keyword);
      const matchesTag = tagFilter === '全部标签' || note.tags.includes(tagFilter);
      return matchesQuery && matchesTag;
    });
  }, [notes, query, tagFilter]);
  const conceptByName = new Map(
    initialTerms.map((term) => [term.name.toLocaleLowerCase(), term.id]),
  );

  async function generate(previousIdempotencyKey?: string) {
    if (!sessionId || generating) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('note-create');
    setGenerating(true);
    setError(null);
    try {
      const data = await requestJson<{ note: Note }>('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, idempotencyKey }),
      });
      setNotes((items) => [data.note, ...items]);
      setSelectedId(data.note.id);
      toast({ title: '笔记已生成', description: data.note.title, tone: 'success' });
    } catch (error) {
      setError({
        message: getErrorMessage(error, '笔记生成失败'),
        retry: () => generate(idempotencyKey),
      });
    } finally {
      setGenerating(false);
    }
  }

  function beginEdit() {
    if (!selected) return;
    setDraftTitle(selected.title);
    setDraftMarkdown(selected.markdown);
    setDraftTags(selected.tags.join(', '));
    setEditing(true);
  }

  async function save(previousIdempotencyKey?: string) {
    if (!selected || !draftTitle.trim() || saving) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('note-update');
    setSaving(true);
    setError(null);
    try {
      const data = await requestJson<{ note: Note }>('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          title: draftTitle,
          markdown: draftMarkdown,
          tags: draftTags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
          idempotencyKey,
        }),
      });
      setNotes((items) => items.map((item) => (item.id === data.note.id ? data.note : item)));
      setEditing(false);
      toast({ title: `已保存版本 ${data.note.version}`, tone: 'success' });
    } catch (error) {
      setError({ message: getErrorMessage(error, '笔记保存失败'), retry: () => save(idempotencyKey) });
    } finally {
      setSaving(false);
    }
  }

  function exportMarkdown(note: Note) {
    const blob = new Blob([note.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${note.title}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell title="学习笔记" description="可编辑、可回溯、保留 AI 原始快照" width="xl">
      <div className="grid min-h-[680px] grid-cols-[17rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card">
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex gap-2">
              <select
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                aria-label="生成笔记的会话"
                className="min-w-0 flex-1 rounded-md border border-border bg-card-soft px-2 text-xs"
              >
                {initialSessions.length === 0 ? <option value="">暂无会话</option> : null}
                {initialSessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.title}</option>
                ))}
              </select>
              <Button size="sm" onClick={() => generate()} loading={generating} disabled={!sessionId}>
                生成
              </Button>
            </div>
            <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-card-soft px-2">
              <Search aria-hidden="true" className="size-3.5 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索笔记"
                placeholder="搜索标题或正文"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="工作区" className="h-8 rounded-md border border-border bg-card-soft px-2 text-xs">
                <option>默认工作区</option>
              </select>
              <select
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                aria-label="标签筛选"
                className="h-8 rounded-md border border-border bg-card-soft px-2 text-xs"
              >
                <option>全部标签</option>
                {allTags.map((tag) => <option key={tag}>{tag}</option>)}
              </select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visibleNotes.length === 0 ? (
              <p className="px-2 py-10 text-center text-xs text-muted">没有匹配的笔记</p>
            ) : (
              visibleNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(note.id);
                    setEditing(false);
                  }}
                  className={`mb-1 w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                    note.id === selectedId ? 'bg-primary/10 text-foreground' : 'hover:bg-card-soft'
                  }`}
                >
                  <span className="block truncate text-xs font-semibold">{note.title}</span>
                  <span className="mt-1 flex items-center justify-between text-[10px] text-muted">
                    <span>版本 {note.version}</span>
                    <span>{new Date(note.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {error ? (
            <InlineNotice
              className="m-4"
              tone="error"
              title="笔记操作未完成"
              description={error.message}
              actionLabel={error.retry ? '重试' : undefined}
              onAction={error.retry}
            />
          ) : null}
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              选择会话生成第一篇笔记
            </div>
          ) : editing ? (
            <NoteEditor
              title={draftTitle}
              markdown={draftMarkdown}
              tags={draftTags}
              saving={saving}
              onTitleChange={setDraftTitle}
              onMarkdownChange={setDraftMarkdown}
              onTagsChange={setDraftTags}
              onCancel={() => setEditing(false)}
              onSave={() => save()}
            />
          ) : (
            <NoteReader
              note={selected}
              conceptByName={conceptByName}
              onEdit={beginEdit}
              onExport={() => exportMarkdown(selected)}
              onVersions={() => setVersionOpen(true)}
            />
          )}
        </main>
      </div>

      {selected ? (
        <VersionDialog note={selected} open={versionOpen} onOpenChange={setVersionOpen} />
      ) : null}
    </PageShell>
  );
}

function NoteEditor({
  title,
  markdown,
  tags,
  saving,
  onTitleChange,
  onMarkdownChange,
  onTagsChange,
  onCancel,
  onSave,
}: {
  title: string;
  markdown: string;
  tags: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onMarkdownChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="笔记标题"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
        />
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X aria-hidden="true" className="size-3.5" />取消
        </Button>
        <Button size="sm" onClick={onSave} loading={saving} disabled={!title.trim()}>
          <Save aria-hidden="true" className="size-3.5" />保存版本
        </Button>
      </div>
      <label className="border-b border-border px-4 py-2 text-xs text-muted">
        标签
        <input
          value={tags}
          onChange={(event) => onTagsChange(event.target.value)}
          aria-label="笔记标签"
          placeholder="用逗号分隔"
          className="ml-3 w-[70%] bg-transparent text-foreground outline-none"
        />
      </label>
      <textarea
        value={markdown}
        onChange={(event) => onMarkdownChange(event.target.value)}
        aria-label="Markdown 正文"
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-card px-6 py-5 font-mono text-sm leading-6 text-card-foreground outline-none"
      />
    </div>
  );
}

function NoteReader({
  note,
  conceptByName,
  onEdit,
  onExport,
  onVersions,
}: {
  note: Note;
  conceptByName: Map<string, string>;
  onEdit: () => void;
  onExport: () => void;
  onVersions: () => void;
}) {
  const blocks = parseMarkdown(note.markdown);
  const headings = blocks.filter((block): block is MarkdownBlock & { type: 'heading' } => block.type === 'heading');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-card-foreground">{note.title}</h2>
            <p className="mt-1 text-xs text-muted">
              版本 {note.version} · AI 快照已保留 · 更新于 {new Date(note.updatedAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <IconButton label="编辑笔记" onClick={onEdit}><Pencil /></IconButton>
            <IconButton label="查看版本" onClick={onVersions}><History /></IconButton>
            <IconButton label="导出 Markdown" onClick={onExport}><Download /></IconButton>
          </div>
        </div>
        {note.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-card-soft px-2 py-1 text-[11px] text-muted">{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {note.sources.map((source) =>
            source.valid && source.sessionId && source.startMessageId ? (
              <Link
                key={source.id}
                href={`/?session=${source.sessionId}&message=${source.startMessageId}`}
                className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[11px] text-accent hover:bg-accent/20"
              >
                <Link2 aria-hidden="true" className="size-3" />
                来源：{source.sessionTitle}
              </Link>
            ) : (
              <span key={source.id} className="inline-flex items-center gap-1 text-[11px] text-danger">
                <Link2Off aria-hidden="true" className="size-3" />来源已失效
              </span>
            ),
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-h-0 overflow-y-auto px-7 py-6">
          <MarkdownDocument blocks={blocks} conceptByName={conceptByName} />
        </div>
        <aside className="border-l border-border px-4 py-5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
            <ListTree aria-hidden="true" className="size-3.5" />目录
          </h3>
          <nav aria-label="笔记目录" className="mt-2 space-y-1">
            {headings.length ? headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`block truncate py-1 text-xs text-muted hover:text-foreground ${heading.level === 3 ? 'pl-3' : ''}`}
              >
                {heading.text}
              </a>
            )) : <span className="text-xs text-muted">暂无标题</span>}
          </nav>
          <div className="mt-6 space-y-1 border-t border-border pt-4">
            <ActionLink href={`/review?note=${note.id}`} icon={<BookOpenCheck />} label="生成复习卡" />
            <ActionLink href={`/practice?note=${note.id}`} icon={<SquareTerminal />} label="生成练习" />
            <ActionLink href={`/?note=${note.id}`} icon={<MessageSquareText />} label="加入上下文" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function VersionDialog({
  note,
  open,
  onOpenChange,
}: {
  note: Note;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const aiVersion = note.versions.find((version) => version.origin === 'ai');
  const currentLines = note.markdown.split('\n').length;
  const aiLines = aiVersion?.markdown.split('\n').length ?? currentLines;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[78vh] overflow-y-auto">
        <DialogTitle className="text-base font-semibold">版本记录</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted">
          AI 初始快照保持只读；当前版本比快照 {currentLines - aiLines >= 0 ? '增加' : '减少'} {Math.abs(currentLines - aiLines)} 行。
        </DialogDescription>
        <div className="mt-5 divide-y divide-border border-y border-border">
          {note.versions.map((version) => (
            <div key={version.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-card-foreground">版本 {version.version}</p>
                <p className="text-xs text-muted">{version.origin === 'ai' ? 'AI 原始快照' : '用户编辑'}</p>
              </div>
              <span className="text-xs text-muted">{new Date(version.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type MarkdownBlock =
  | { type: 'heading'; id: string; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; text: string }
  | { type: 'code'; language: string; code: string };

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split('\n');
  const blocks: MarkdownBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'text';
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', language, code: code.join('\n') });
    } else if (/^#{1,3}\s/.test(line)) {
      const match = /^(#{1,3})\s+(.*)$/.exec(line)!;
      blocks.push({ type: 'heading', id: `note-heading-${index}`, level: match[1].length, text: match[2] });
    } else if (/^[-*]\s/.test(line)) {
      blocks.push({ type: 'list', text: line.replace(/^[-*]\s+/, '') });
    } else if (line.trim()) {
      blocks.push({ type: 'paragraph', text: line });
    }
  }
  return blocks;
}

function MarkdownDocument({ blocks, conceptByName }: { blocks: MarkdownBlock[]; conceptByName: Map<string, string> }) {
  return (
    <article className="space-y-3 text-sm leading-6 text-card-foreground">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
          return <Tag key={block.id} id={block.id} className={`${block.level === 1 ? 'text-xl' : 'mt-5 text-base'} font-semibold`}>{block.text}</Tag>;
        }
        if (block.type === 'code') return <CodeBlock key={index} language={block.language} code={block.code} />;
        if (block.type === 'list') return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{renderConceptText(block.text, conceptByName)}</p>;
        return <p key={index}>{renderConceptText(block.text, conceptByName)}</p>;
      })}
    </article>
  );
}

function renderConceptText(text: string, conceptByName: Map<string, string>) {
  const match = /\*\*([^*]+)\*\*/.exec(text);
  if (!match) return text;
  const id = conceptByName.get(match[1].toLocaleLowerCase());
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return <>{before}{id ? <Link href={`/?concept=${id}`} className="font-semibold text-accent hover:underline">{match[1]}</Link> : <strong>{match[1]}</strong>}{after}</>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const input = document.createElement('textarea');
      input.value = code;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card-soft">
      <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] text-muted">
        <span>{language}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 hover:text-foreground">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-5"><code>{code}</code></pre>
    </div>
  );
}

function ActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-card-foreground hover:bg-card-soft [&_svg]:size-3.5">
      {icon}{label}
    </Link>
  );
}
