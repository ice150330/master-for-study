'use client';

import { useState, type ReactNode } from 'react';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import type { ChatSession } from './chat-types';

/**
 * 全部会话选择器：收纳旧侧边栏能力——以弹层树列出所有会话（含其它根会话），
 * 点击切换；「+ 新话题」直接新建根会话。
 */
export function SessionPicker({
  sessions,
  currentId,
  onSelect,
  onNew,
}: {
  sessions: ChatSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tree = buildSessionTree(sessions);

  return (
    <div className="relative">
      {open && (
        // 透明背板：点击任意处关闭
        <button
          type="button"
          aria-label="关闭"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card hover:text-card-foreground"
        >
          <ListIcon />
          会话列表
          {sessions.length > 0 && (
            <span className="rounded-full bg-card px-1.5 text-[10px] text-muted">
              {sessions.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          + 新话题
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-10 z-40 w-72 rounded-2xl border border-border bg-card p-2 shadow-xl">
          {tree.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">暂无会话，点「+ 新话题」开始</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              {renderTree(tree, currentId, (id) => {
                setOpen(false);
                onSelect(id);
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 递归渲染会话树（缩进 + 左侧竖线做层级连线）。 */
function renderTree(
  nodes: SessionTreeNode<ChatSession>[],
  currentId: string | null,
  onSelect: (id: string) => void,
  depth = 0,
): ReactNode {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-border pl-2' : 'space-y-0.5'}>
      {nodes.map((n) => (
        <li key={n.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={`w-full truncate rounded-lg px-2 py-1 text-left text-xs transition-colors ${
              n.id === currentId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-card-soft hover:text-card-foreground'
            }`}
          >
            {n.title}
          </button>
          {n.children.length > 0 && renderTree(n.children, currentId, onSelect, depth + 1)}
        </li>
      ))}
    </ul>
  );
}

function ListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
