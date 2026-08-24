'use client';

import { useMemo, useState } from 'react';
import type { TermAction } from './Term';
import { SessionCard } from './SessionCard';
import { SessionTabs } from './SessionTabs';
import type { ChatMsg, ChatModel, ChatResource, ChatSession } from './chat-types';

/**
 * 会话卡片舞台：主卡占满可用空间，父级 / 分支以「纸签」贴在卡片左右边缘
 * （不再为堆叠预留尺寸）；完整树形导航由会话树抽屉承担。
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
  starters,
  onStarter,
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
  onOpenTree,
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
  starters?: string[];
  onStarter?: (prompt: string) => void;
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
  /** 点击纸签切换会话 */
  onSelect: (id: string) => void;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onBranchFromMessage: (messageId: string) => void;
  /** 纸签溢出时打开会话树抽屉 */
  onOpenTree: () => void;
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
      <div className="relative min-h-0 flex-1">
        <SessionTabs
          ancestors={ancestors}
          branches={branches}
          onSelect={(id) => {
            const isAncestor = ancestors.some((session) => session.id === id);
            if (isAncestor) selectAncestor(id);
            else selectBranch(id);
          }}
          onOpenTree={onOpenTree}
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
              starters={starters}
              onStarter={onStarter}
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
