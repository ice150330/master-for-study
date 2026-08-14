import type { ReactNode } from 'react';

export type TermAction = 'branch' | 'new' | 'followup';

/**
 * 术语高亮组件：术语本身用点缀色 + 点下划线高亮，hover 弹出「一句话解释 + 三选项」。
 * 弹窗通过 pointer-events / group-hover 实现可悬停可点击（无缝隙，避免移入时消失）。
 * z-30 保证在会话卡片堆（z-20 以下）之上。
 */
export function Term({
  name,
  definition,
  onAction,
  sourceMessageId,
}: {
  name: string;
  definition?: string;
  onAction?: (action: TermAction, name: string, messageId: string) => void;
  sourceMessageId: string;
}) {
  return (
    <span className="group relative inline-flex">
      <span className="cursor-help rounded px-0.5 font-medium text-accent underline decoration-dotted decoration-accent/70 underline-offset-4">
        {name}
      </span>

      {/* 悬停弹窗（bottom-full 无缝隙定位） */}
      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-0 w-60 rounded-2xl bg-card p-3 opacity-0 shadow-xl transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="mb-1 text-sm font-semibold text-card-foreground">{name}</div>
        <div className="mb-2 text-xs leading-relaxed text-card-foreground/75">
          {definition ?? '解释加载中…'}
        </div>
        <div className="flex gap-1.5">
          <ActionButton
            className="bg-primary text-primary-foreground"
            onClick={() => onAction?.('branch', name, sourceMessageId)}
          >
            分支会话
          </ActionButton>
          <ActionButton
            className="bg-accent text-accent-foreground"
            onClick={() => onAction?.('new', name, sourceMessageId)}
          >
            新会话
          </ActionButton>
          <ActionButton
            className="bg-pink text-pink-foreground"
            onClick={() => onAction?.('followup', name, sourceMessageId)}
          >
            追问
          </ActionButton>
        </div>
      </span>
    </span>
  );
}

function ActionButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </button>
  );
}
