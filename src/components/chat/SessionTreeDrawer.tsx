'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArchiveRestore, FolderTree, ListTree, Pin, Plus, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import type { ChatSession } from './chat-types';

/**
 * 会话树抽屉（吸收原 SessionPicker）：右侧滑入的全局会话导航。
 * 纸签管上下文快速跳转，这里管全局树视图——搜索、当前路径高亮、
 * 置顶标记、归档恢复与新话题；桌面 / 移动同一套交互。
 */
export function SessionTreeDrawer({
  open,
  onOpenChange,
  sessions,
  archivedSessions,
  currentId,
  onSelect,
  onNew,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRestore: (id: string) => void;
}) {
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] data-[state=open]:animate-ui-enter" />
        <DialogPrimitive.Content className="paper-popover fixed right-0 top-0 z-50 flex h-dvh w-[min(21rem,92vw)] flex-col border-y-0 border-r-0 border-l-2 text-card-foreground data-[state=open]:animate-drawer-in">
          <header className="flex shrink-0 items-center gap-2 border-b border-dashed border-border px-4 py-3.5">
            <FolderTree aria-hidden="true" className="size-4 text-primary" />
            <DialogPrimitive.Title className="doodle-heading text-sm font-extrabold">
              会话树
            </DialogPrimitive.Title>
            {sessions.length > 0 ? (
              <span className="rotate-[-1deg] rounded-[2px] border border-dashed border-border bg-highlight/20 px-1.5 text-[10px] text-muted">
                {sessions.length}
              </span>
            ) : null}
            <DialogPrimitive.Close
              aria-label="关闭会话树"
              className="ml-auto inline-flex size-8 items-center justify-center rounded-[2px] border border-dashed border-transparent text-muted transition-[transform,background-color,color,border-color] hover:rotate-3 hover:border-danger/60 hover:bg-danger/10 hover:text-danger active:translate-x-0.5 active:translate-y-0.5"
            >
              <X aria-hidden="true" className="size-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="shrink-0 space-y-2 border-b border-dashed border-border px-4 py-3">
            <label className="relative block">
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索会话"
                placeholder="搜索标题"
                className="h-9 w-full rounded-[2px] border-2 border-dashed border-border bg-card-soft pl-8 pr-3 text-sm outline-none transition-[transform,border-color,box-shadow] focus:-translate-x-px focus:-translate-y-px focus:border-accent focus:shadow-[3px_3px_0_rgba(78,205,196,0.34)]"
              />
            </label>
            <Button size="sm" className="w-full" onClick={onNew}>
              <Plus aria-hidden="true" className="size-4" />
              新话题
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <DialogPrimitive.Description className="sr-only">
              按树形结构浏览全部会话，点击切换当前会话
            </DialogPrimitive.Description>
            {tree.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted">
                {normalizedQuery ? '没有匹配的活跃会话' : '暂无会话，创建一个新话题开始'}
              </p>
            ) : (
              renderTree(tree, currentId, onSelect)
            )}

            {visibleArchived.length > 0 ? (
              <section className="mt-3 border-t border-dashed border-border pt-3">
                <p className="px-2 pb-1 text-[11px] font-medium text-muted">已归档</p>
                <ul className="space-y-0.5">
                  {visibleArchived.map((session) => (
                    <li
                      key={session.id}
                      className="doodle-row flex items-center gap-1 rounded-[2px] border border-dashed border-transparent px-2 py-1 hover:bg-highlight/15"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">{session.title}</span>
                      <button
                        type="button"
                        aria-label={`恢复会话 ${session.title}`}
                        onClick={() => onRestore(session.id)}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 会话卡头部触发按钮：紧凑图标按钮 + 会话数角标（原顶栏大按钮收进卡头）。 */
export function SessionTreeTrigger({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={count > 0 ? `打开会话树（共 ${count} 个会话）` : '打开会话树'}
      onClick={onOpen}
      className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-dashed border-transparent text-muted transition-[transform,background-color,color,border-color,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:border-foreground/45 hover:bg-highlight/20 hover:text-foreground hover:shadow-[2px_2px_0_rgba(78,205,196,0.42)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
    >
      <ListTree aria-hidden="true" className="size-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 rotate-[-2deg] rounded-[2px] border border-dashed border-border bg-card px-1 text-[9px] font-semibold leading-3.5 text-muted">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

function renderTree(
  nodes: SessionTreeNode<ChatSession>[],
  currentId: string | null,
  onSelect: (id: string) => void,
  depth = 0,
): ReactNode {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-dashed border-border pl-2' : 'space-y-0.5'}>
      {nodes.map((node) => (
        <li key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`doodle-row flex w-full items-center gap-1.5 rounded-[2px] border border-dashed px-2 py-1.5 text-left text-xs ${
              node.id === currentId
                ? 'rotate-[-0.25deg] border-foreground bg-foreground text-background shadow-[2px_2px_0_var(--marker-yellow)]'
                : 'border-transparent text-muted hover:bg-card-soft hover:text-card-foreground'
            }`}
          >
            {node.pinnedAt ? <Pin aria-label="已置顶" className="size-3 shrink-0 fill-current" /> : null}
            <span className="min-w-0 flex-1 truncate">{node.title}</span>
            <span className="shrink-0 text-[10px] opacity-70">{formatSessionTime(node.updatedAt)}</span>
          </button>
          {node.children.length > 0 ? renderTree(node.children, currentId, onSelect, depth + 1) : null}
        </li>
      ))}
    </ul>
  );
}

/** 轻量相对时间：今天显示时刻，更早显示月/日。 */
function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
