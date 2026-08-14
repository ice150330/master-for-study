'use client';

import { useMemo } from 'react';
import type { TermAction } from './Term';
import { AncestorStack } from './AncestorStack';
import { BranchFan } from './BranchFan';
import { SessionCard } from './SessionCard';
import type { ChatMsg, ChatModel, ChatSession } from './chat-types';

/**
 * 会话卡片堆舞台：组装「祖先竖条堆 + 当前会话大卡片 + 分支扇」。
 * 祖先链与分支都是从扁平 sessions 派生的纯数据（复用 parentId 自引用）。
 */
export function SessionDeck({
  sessions,
  currentSessionId,
  messages,
  isStreaming,
  termDefs,
  onTermAction,
  input,
  onInputChange,
  onSend,
  onStop,
  onRegenerate,
  onContinue,
  requestError,
  model,
  onModelChange,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMsg[];
  isStreaming: boolean;
  termDefs: Record<string, string>;
  onTermAction: (action: TermAction, name: string) => void;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: () => void;
  onContinue: () => void;
  requestError: {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null;
  model: ChatModel;
  onModelChange: (m: ChatModel) => void;
  /** 点击祖先竖条 / 分支小卡时切换会话 */
  onSelect: (id: string) => void;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const nodeById = useMemo(() => {
    const map = new Map<string, ChatSession>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  // 祖先链：沿 parentId 向上走（由近到远：父、祖父…）
  const ancestors = useMemo(() => {
    const chain: ChatSession[] = [];
    let cur = currentSessionId ? nodeById.get(currentSessionId) : undefined;
    while (cur?.parentId) {
      const parent = nodeById.get(cur.parentId);
      if (!parent) break;
      chain.push(parent);
      cur = parent;
    }
    return chain;
  }, [nodeById, currentSessionId]);

  // 分支：当前会话的直接子会话
  const branches = useMemo(
    () => sessions.filter((s) => s.parentId === currentSessionId),
    [sessions, currentSessionId],
  );

  const current = currentSessionId ? nodeById.get(currentSessionId) : undefined;
  const lineage = ancestors.length > 0 ? `承自 · ${ancestors[0].title}` : null;

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-2">
      {/* 左：祖先堆（竖条卡片，向左后方层叠） */}
      <AncestorStack ancestors={ancestors} onSelect={onSelect} />

      {/* 右：当前会话大卡片 + 右上角分支扇 */}
      <div className="relative min-w-0 flex-1">
        <SessionCard
          session={current ?? null}
          title={current?.title ?? '新对话'}
          lineage={lineage}
          hasBranches={branches.length > 0}
          messages={messages}
          isStreaming={isStreaming}
          termDefs={termDefs}
          onTermAction={onTermAction}
          input={input}
          onInputChange={onInputChange}
          onSend={onSend}
          onStop={onStop}
          onRegenerate={onRegenerate}
          onContinue={onContinue}
          requestError={requestError}
          model={model}
          onModelChange={onModelChange}
          onRename={onRename}
          onPin={onPin}
          onArchive={onArchive}
          onDelete={onDelete}
        />
        <BranchFan branches={branches} onSelect={onSelect} />
      </div>
    </div>
  );
}
