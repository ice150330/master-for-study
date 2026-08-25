'use client';

import { ArchiveRestore, FolderTree, ListTree, Pin, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import { useHoverSwitch } from '@/lib/use-hover-switch';
import type { ChatSession } from './chat-types';

/**
 * 会话树气泡（原右侧抽屉改为向下弹出）：从卡片头部的树形按钮向下弹出的
 * 气泡面板，**鼠标悬停即开、移开即关**（进面板停留不关；触摸设备仍走点击，
 * 悬停只对 pointerType=mouse 生效避免点按竞态）。Radix Popover 锚定触发器，
 * 外点关闭 / Escape / 焦点返回全部继承，顶部小尾巴指回按钮。
 * 内容：搜索、完整会话树、置顶与相对时间、归档恢复；「+N」胶带共用受控 open。
 * 新话题在卡片头部最右侧的独立按钮（不放面板内）。
 */
export function SessionTreeMenu({
  open,
  onOpenChange,
  sessions,
  archivedSessions,
  currentId,
  onSelect,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  // 受控悬停开关：open 与「+N」胶带共用，移进面板停留不关
  const { setOpen, hoverOpen, hoverClose, hoverStay } = useHoverSwitch({ open, onOpenChange });
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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <SessionTreeTrigger
          count={sessions.length}
          tooltip={false}
          onPointerEnter={hoverOpen}
          onPointerLeave={(event) => hoverClose(event)}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="tree-bubble w-[min(22rem,92vw)] p-0"
        onPointerEnter={hoverStay}
        onPointerLeave={(event) => hoverClose(event)}
        onKeyDown={(event) => {
          // 显式兜底：受控 open 下确保 Escape 一定关闭（与 Radix 内部处理幂等）
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-dashed border-border px-3.5 py-2.5">
          <FolderTree aria-hidden="true" className="size-4 text-primary" />
          <span className="doodle-heading text-sm font-extrabold">会话树</span>
          {sessions.length > 0 ? (
            <span className="rotate-[-1deg] rounded-[2px] border border-dashed border-border bg-highlight/20 px-1.5 text-[10px] text-muted">
              {sessions.length}
            </span>
          ) : null}
        </header>

        <div className="border-b border-dashed border-border px-3.5 py-2.5">
          <label className="relative block">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索会话"
              placeholder="搜索标题"
              className="h-9 w-full rounded-[2px] border-2 border-dashed border-border bg-card-soft pl-8 pr-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[3px_3px_0_rgba(78,205,196,0.34)]"
            />
          </label>
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-2.5 py-3">
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
      </PopoverContent>
    </Popover>
  );
}

/** 会话卡头部触发按钮：IconButton（统一悬停样式）+ 会话数角标；
    透传 props / ref 给 Radix asChild（PopoverTrigger 注入开关语义），
    tooltip 可关（悬停已用于开面板，提示反而碍事）。 */
export function SessionTreeTrigger({
  count,
  tooltip = true,
  ...props
}: { count: number; tooltip?: boolean } & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <IconButton
      className="relative size-8 shrink-0"
      tooltip={tooltip}
      {...props}
      label={count > 0 ? `打开会话树（共 ${count} 个会话）` : '打开会话树'}
    >
      <ListTree aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 rotate-[-2deg] rounded-[2px] border border-dashed border-border bg-card px-1 text-[9px] font-semibold leading-3.5 text-muted">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </IconButton>
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
