'use client';

import { ArchiveRestore, ListTree, Pin, Plus, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import type { ChatSession } from './chat-types';

export function SessionPicker({
  sessions,
  archivedSessions,
  currentId,
  onSelect,
  onNew,
  onRestore,
}: {
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRestore: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const visibleSessions = useMemo(
    () =>
      normalizedQuery
        ? sessions.filter((session) => session.title.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
        : sessions,
    [normalizedQuery, sessions],
  );
  const visibleArchived = useMemo(
    () =>
      normalizedQuery
        ? archivedSessions.filter((session) =>
            session.title.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
          )
        : archivedSessions,
    [archivedSessions, normalizedQuery],
  );
  const tree = buildSessionTree(visibleSessions);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={open ? '关闭会话列表' : '打开会话列表'}
          >
            <ListTree aria-hidden="true" className="size-4" />
            会话列表
            {sessions.length > 0 ? (
              <span className="rounded bg-surface px-1.5 text-[10px] text-muted">{sessions.length}</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <Button size="sm" onClick={onNew}>
          <Plus aria-hidden="true" className="size-4" />
          新话题
        </Button>
      </div>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] p-2 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索会话"
              placeholder="搜索标题"
              autoFocus
              className="h-9 w-full rounded-md border border-border bg-card-soft pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <PopoverClose asChild>
            <button
              type="button"
              aria-label="关闭会话列表"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-card-soft hover:text-card-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </PopoverClose>
        </div>

        <div className="mt-2 max-h-[52vh] overflow-y-auto">
          {tree.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted">
              {normalizedQuery ? '没有匹配的活跃会话' : '暂无会话，创建一个新话题开始'}
            </p>
          ) : (
            renderTree(tree, currentId, (id) => {
              setOpen(false);
              onSelect(id);
            })
          )}

          {visibleArchived.length > 0 ? (
            <section className="mt-2 border-t border-border pt-2">
              <p className="px-2 py-1 text-[11px] font-medium text-muted">已归档</p>
              <ul className="space-y-0.5">
                {visibleArchived.map((session) => (
                  <li key={session.id} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-surface">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">{session.title}</span>
                    <button
                      type="button"
                      aria-label={`恢复会话 ${session.title}`}
                      onClick={() => {
                        setOpen(false);
                        onRestore(session.id);
                      }}
                      className="inline-flex size-7 items-center justify-center rounded text-muted hover:bg-card hover:text-foreground"
                    >
                      <ArchiveRestore aria-hidden="true" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function renderTree(
  nodes: SessionTreeNode<ChatSession>[],
  currentId: string | null,
  onSelect: (id: string) => void,
  depth = 0,
): ReactNode {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-border pl-2' : 'space-y-0.5'}>
      {nodes.map((node) => (
        <li key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
              node.id === currentId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-card-soft hover:text-card-foreground'
            }`}
          >
            {node.pinnedAt ? <Pin aria-label="已置顶" className="size-3 shrink-0 fill-current" /> : null}
            <span className="truncate">{node.title}</span>
          </button>
          {node.children.length > 0 ? renderTree(node.children, currentId, onSelect, depth + 1) : null}
        </li>
      ))}
    </ul>
  );
}
