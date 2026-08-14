'use client';

import {
  Archive,
  CornerDownRight,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Input } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { MessageContent } from './MessageContent';
import type { TermAction } from './Term';
import type { ChatMsg, ChatModel, ChatSession } from './chat-types';

/**
 * 当前会话大卡片：标题栏（标题 + 血缘提示 + 模型切换）+ 消息流 + 输入区。
 * 整张卡即一个会话；派生新会话后本卡退为祖先竖条（见 AncestorStack）。
 */
export function SessionCard({
  session,
  title,
  lineage,
  hasBranches,
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
  onRename,
  onPin,
  onArchive,
  onDelete,
  onBranchFromMessage,
}: {
  session: ChatSession | null;
  title: string;
  /** 血缘提示，如「承自 · HTTP 是什么」；根会话为 null */
  lineage: string | null;
  /** 是否有分支扇叠在右上角（决定标题栏右侧留白） */
  hasBranches: boolean;
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
  requestError: {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null;
  model: ChatModel;
  onModelChange: (m: ChatModel) => void;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onBranchFromMessage: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(title);

  // 消息变化（含流式逐段更新）时，滚动容器贴底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {/* 标题栏：分支扇存在时给右侧留白避让 */}
      <div
        className={`flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3 ${
          hasBranches ? 'pr-[15.5rem]' : ''
        }`}
      >
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-card-foreground">{title}</h2>
          <p className="truncate text-[11px] text-muted">
            {lineage ?? '根会话'} · {messages.length} 条消息
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ModelSwitch value={model} onChange={onModelChange} />
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="会话操作">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameTitle(title);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil /> 重命名
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPin(!session.pinnedAt)}>
                  {session.pinnedAt ? <PinOff /> : <Pin />}
                  {session.pinnedAt ? '取消置顶' : '置顶会话'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onArchive}>
                  <Archive /> 归档
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> 删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            随便问个技术问题，比如「什么是 DNS？」
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`group/message flex items-start gap-1.5 ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'user' && m.status === 'complete' && !isStreaming ? (
              <MessageBranchButton messageId={m.id} onBranch={onBranchFromMessage} />
            ) : null}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card-soft text-card-foreground'
              } ${m.status === 'error' ? 'border border-danger/35' : ''}`}
            >
              {m.content ? (
                <MessageContent
                  text={m.content}
                  termDefs={termDefs}
                  onTermAction={onTermAction}
                  messageId={m.id}
                />
              ) : m.status === 'error' ? (
                <span className="text-danger">回答未完成</span>
              ) : null}
              {m.status === 'error' && m.error ? (
                <p className="mt-1 text-xs text-danger">{m.error}</p>
              ) : null}
            </div>
            {m.role === 'assistant' && m.status === 'complete' && !isStreaming ? (
              <MessageBranchButton messageId={m.id} onBranch={onBranchFromMessage} />
            ) : null}
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <span className="text-xs text-muted">思考中…</span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-border p-3">
        {requestError ? (
          <InlineNotice
            className="mb-2"
            tone="error"
            title={requestError.title}
            description={requestError.description}
            actionLabel={requestError.actionLabel}
            onAction={requestError.onAction}
          />
        ) : null}
        {!isStreaming && messages.some((message) => message.role === 'user') ? (
          <div className="mb-2 flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onRegenerate}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              重新生成
            </Button>
            <Button size="sm" variant="ghost" onClick={onContinue}>
              <CornerDownRight aria-hidden="true" className="size-3.5" />
              继续回答
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
            className="flex-1 resize-none rounded-xl border border-border bg-card-soft px-4 py-3 text-sm text-card-foreground outline-none placeholder:text-card-foreground/50 focus:border-primary"
          />
          {isStreaming ? (
            <Button className="h-[46px]" variant="outline" onClick={onStop}>
              <Square aria-hidden="true" className="size-4 fill-current" />
              停止
            </Button>
          ) : (
            <Button className="h-[46px]" onClick={onSend}>
              <SendHorizontal aria-hidden="true" className="size-4" />
              发送
            </Button>
          )}
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold">重命名会话</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            标题用于会话搜索和分支路径，不会修改消息内容。
          </DialogDescription>
          <Input
            className="mt-5"
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && renameTitle.trim()) {
                onRename(renameTitle.trim());
                setRenameOpen(false);
              }
            }}
            aria-label="会话标题"
            maxLength={120}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>取消</Button>
            <Button
              disabled={!renameTitle.trim()}
              onClick={() => {
                onRename(renameTitle.trim());
                setRenameOpen(false);
              }}
            >
              保存标题
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold">删除会话</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted">
            会话和消息将被删除；已有笔记与面试记录会保留，但不再关联此会话。该操作不可撤销。
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBranchButton({
  messageId,
  onBranch,
}: {
  messageId: string;
  onBranch: (messageId: string) => void;
}) {
  return (
    <IconButton
      className="mt-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-visible:opacity-100"
      label="从这里分支"
      onClick={() => onBranch(messageId)}
    >
      <GitBranch aria-hidden="true" />
    </IconButton>
  );
}

/** 模型切换：闪电（v4-flash，默认）/ 深思（v4-pro，重任务）。 */
function ModelSwitch({
  value,
  onChange,
}: {
  value: ChatModel;
  onChange: (m: ChatModel) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-card-soft p-0.5">
      <button
        type="button"
        onClick={() => onChange('fast')}
        aria-pressed={value === 'fast'}
        title="deepseek-v4-flash · 快速回复，日常问答"
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          value === 'fast'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted hover:text-foreground'
        }`}
      >
        <Zap aria-hidden="true" className="size-3" />
        闪电
      </button>
      <button
        type="button"
        onClick={() => onChange('pro')}
        aria-pressed={value === 'pro'}
        title="deepseek-v4-pro · 深度思考，重任务"
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          value === 'pro'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted hover:text-foreground'
        }`}
      >
        <Sparkles aria-hidden="true" className="size-3" />
        深思
      </button>
    </div>
  );
}
