'use client';

import { useMemo, useState } from 'react';
import type { TermAction } from './Term';
import { AncestorStack } from './AncestorStack';
import { BranchFan } from './BranchFan';
import { SessionCard } from './SessionCard';
import type { ChatMsg, ChatModel, ChatResource, ChatSession } from './chat-types';

/**
 * 会话卡片堆舞台：父会话、当前会话与后续分支共享同尺寸卡体并沿路径直接叠放。
 * 祖先链与分支都从扁平 sessions 派生，不在前端复制会话树状态。
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
  resourceOptions,
  selectedResourceIds,
  onToggleResource,
  requestError,
  model,
  onModelChange,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
  onBranchFromMessage,
}: {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMsg[];
  isStreaming: boolean;
  termDefs: Record<string, string>;
  onTermAction: (action: TermAction, name: string, messageId: string) => void;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: () => void;
  onContinue: () => void;
  resourceOptions: ChatResource[];
  selectedResourceIds: string[];
  onToggleResource: (id: string) => void;
  requestError: {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null;
  model: ChatModel;
  onModelChange: (m: ChatModel) => void;
  /** 点击露出的父级 / 后续分支卡沿时切换会话 */
  onSelect: (id: string) => void;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onBranchFromMessage: (messageId: string) => void;
}) {
  const [motionDirection, setMotionDirection] = useState<'neutral' | 'back' | 'forward'>('neutral');
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
  const lineage = ancestors.length > 0 ? `承自 ${ancestors[0].title}` : null;

  const path = [...ancestors].reverse();
  const hasStack = ancestors.length > 0 || branches.length > 0;

  const selectAncestor = (id: string) => {
    setMotionDirection('back');
    onSelect(id);
  };

  const selectBranch = (id: string) => {
    setMotionDirection('forward');
    onSelect(id);
  };

  return (
    <div className="@container/session-stack flex min-h-0 flex-1 flex-col">
      <nav
        aria-label="会话分支路径"
        className="paper-control mb-2 hidden h-10 shrink-0 items-center gap-1 overflow-x-auto rounded-[2px] border border-dashed border-border bg-card px-2 @max-[719px]/session-stack:flex"
      >
        {path.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => selectAncestor(session.id)}
            className="flex min-h-7 shrink-0 items-center rounded-[2px] border border-dashed border-transparent px-1.5 text-xs text-muted transition-colors hover:border-accent/60 hover:bg-highlight/15 hover:text-foreground"
          >
            {session.title}
            <span aria-hidden="true" className="ml-1.5 text-border">/</span>
          </button>
        ))}
        <span className="shrink-0 text-xs font-medium text-foreground">
          {current?.title ?? '新对话'}
        </span>
        {branches.length > 0 ? (
          <select
            aria-label="选择子分支"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) selectBranch(event.target.value);
            }}
            className="ml-auto h-7 max-w-48 shrink-0 rounded-[2px] border border-dashed border-border bg-card-soft px-2 text-xs text-foreground"
          >
            <option value="">子分支 ({branches.length})</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.title}</option>
            ))}
          </select>
        ) : null}
      </nav>
      <div
        className={`relative min-h-0 flex-1 ${
          hasStack ? '@min-[720px]/session-stack:px-12' : ''
        } ${
          ancestors.length > 0 ? '@min-[720px]/session-stack:pt-28' : ''
        } ${
          branches.length > 0 ? '@min-[720px]/session-stack:pb-28' : ''
        }`}
      >
        <AncestorStack
          ancestors={ancestors}
          hasBranches={branches.length > 0}
          onSelect={selectAncestor}
        />
        <BranchFan
          branches={branches}
          hasAncestors={ancestors.length > 0}
          onSelect={selectBranch}
        />

        <div className="relative z-30 h-full min-h-0 min-w-0">
          <div
            key={currentSessionId ?? 'empty'}
            data-session-direction={motionDirection}
            className="h-full animate-session-enter"
          >
            <SessionCard
              session={current ?? null}
              title={current?.title ?? '新对话'}
              lineage={lineage}
              depth={ancestors.length}
              branchCount={branches.length}
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
              resourceOptions={resourceOptions}
              selectedResourceIds={selectedResourceIds}
              onToggleResource={onToggleResource}
              requestError={requestError}
              model={model}
              onModelChange={onModelChange}
              onRename={onRename}
              onPin={onPin}
              onArchive={onArchive}
              onDelete={onDelete}
              onBranchFromMessage={onBranchFromMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
