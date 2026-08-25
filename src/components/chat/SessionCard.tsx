'use client';

import {
  Archive,
  BookOpenText,
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useHoverSwitch } from '@/lib/use-hover-switch';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { WorkspaceSwitcher } from '@/components/shell/WorkspaceSwitcher';
import {
  TEACHER_STYLES,
  teacherStyleLabel,
  type TeacherStyle,
} from '@/lib/ai/teacher-style';
import { MessageContent } from './MessageContent';
import { MentorAvatar } from './MentorAvatar';
import type { TermAction } from './Term';
import type { ChatMsg, ChatModel, ChatResource, ChatSession } from './chat-types';

/**
 * 当前会话主卡：血缘标题栏（树 / 新话题 / 会话操作）+ 消息流 + 输入区。
 * 输入区上方常驻紧凑工具条：老师风格与模型双态切换；派生会话后，
 * 本卡经血缘标题栏与上下缘胶带纸签（见 SessionTabs）保持可回溯。
 */
export function SessionCard({
  session,
  title,
  lineage,
  depth,
  branchCount,
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
  onSummarize,
  resourceOptions,
  selectedResourceIds,
  onToggleResource,
  requestError,
  model,
  onModelChange,
  styleOverride,
  fallbackStyle,
  onStyleChange,
  treeMenu,
  onNewSession,
  onRename,
  onPin,
  onArchive,
  onDelete,
  onBranchFromMessage,
}: {
  session: ChatSession | null;
  title: string;
  /** 血缘提示，如「承自 HTTP 是什么」；根会话为 null */
  lineage: string | null;
  depth: number;
  branchCount: number;
  messages: ChatMsg[];
  isStreaming: boolean;
  termDefs: Record<string, string>;
  onTermAction: (action: TermAction, name: string, messageId: string) => void;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  /** 冷启动引导问题（C2）：空会话一键发送 */
  starters?: string[];
  onStarter?: (prompt: string) => void;
  onStop: () => void;
  /** 重写最后一条回答（回复操作行触发） */
  onRegenerate: () => void;
  /** 从某条回答派生分支并生成详细综述 */
  onSummarize: (messageId: string, content: string) => void;
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
  /** 会话内风格临时切换（null = 跟随全局默认） */
  styleOverride: TeacherStyle | null;
  fallbackStyle: TeacherStyle;
  onStyleChange: (next: TeacherStyle | null) => void;
  /** 会话树气泡（含触发器），渲染在头部 */
  treeMenu: React.ReactNode;
  onNewSession: () => void;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onBranchFromMessage: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // 消息变化（含流式逐段更新）时，滚动容器贴底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="session-current-card flex h-full flex-col overflow-hidden rounded-[2px] border border-border bg-card shadow-[var(--shadow-md)]">
      {/* 单行状态栏：深度 · 标题 · 血缘与计数 · 工具组（工作区 / 树 / 新话题 / 操作） */}
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-dashed border-border px-4">
        <span aria-hidden="true" className="h-5 w-1 shrink-0 rotate-1 bg-primary shadow-[2px_0_0_var(--marker-yellow)]" />
        <span className="shrink-0 rotate-[-2deg] border border-dashed border-primary bg-primary/12 px-1 text-[10px] font-semibold text-primary">
          D{depth}
        </span>
        <h2 className="doodle-heading min-w-0 flex-1 truncate text-sm font-extrabold text-card-foreground">
          {title}
        </h2>
        <p className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted lg:flex">
          <span className="max-w-44 truncate">{lineage ?? '根会话'}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{messages.length} 条</span>
          {branchCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{branchCount} 分支</span>
            </>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <WorkspaceSwitcher />
          {treeMenu}
          {session ? (
            <SessionOpsMenu
              session={session}
              title={title}
              onRename={onRename}
              onPin={onPin}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ) : null}
          {/* 新话题：卡片头部最右侧的独立按钮 */}
          <IconButton label="新话题" onClick={onNewSession}>
            <Plus aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 [contain:layout_paint]">
        {messages.length === 0 && (
          <div className="mx-auto my-14 w-fit max-w-md text-center">
            <p className="marker-highlight rotate-[-0.5deg] text-sm font-semibold text-muted">还没有消息</p>
            {starters && starters.length > 0 ? (
              <>
                <p className="mt-4 text-[11px] text-muted">从这里开始，或直接输入你的问题</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {starters.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onStarter?.(prompt)}
                      className="doodle-row paper-subtle rounded-[2px] border border-dashed px-3 py-2 text-left text-xs text-card-foreground transition-[transform,background-color,border-color] hover:-translate-x-px hover:-translate-y-px hover:border-accent/60 hover:bg-highlight/15"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
        {messages.map((m, messageIndex) => {
          // 最后一条完整回答才允许原位重写，更早的回答只能经分支派生
          let lastAssistantId: string | null = null;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].status === 'complete') {
              lastAssistantId = messages[i].id;
              break;
            }
          }
          const showActions = m.role === 'assistant' && m.status === 'complete' && !isStreaming && !!m.content;
          // AI 组紧跟提问上移 ~30px（头像与提问行大致齐平）；仅在上一条是用户消息时生效
          const hugQuestion = m.role === 'assistant' && messageIndex > 0 && messages[messageIndex - 1].role === 'user';
          return (
            <div
              key={m.id}
              data-message-id={m.id}
              className={`group/message flex items-start gap-1.5 ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex min-w-0 max-w-[85%] flex-col ${
                  m.role === 'user' ? 'items-end' : `items-start${hugQuestion ? ' -mt-[30px]' : ''}`
                }`}
              >
                {/* AI 老师头像：气泡正上方靠左，气泡折角尾巴指向它；上移后与提问行大致齐平 */}
                {m.role === 'assistant' ? (
                  <MentorAvatar className="mb-0.5 ml-1 size-8" />
                ) : null}
                <div
                  className={`relative break-words rounded-[2px] border-2 border-dashed px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                    m.role === 'user'
                      ? 'rotate-[0.2deg] border-primary/60 bg-primary/8 text-card-foreground shadow-[4px_4px_0_rgba(255,107,107,0.2)]'
                      : 'paper-subtle -rotate-[0.1deg] border-accent/55 text-card-foreground shadow-[4px_4px_0_rgba(78,205,196,0.2)]'
                  } ${m.status === 'error' ? 'border border-danger/35' : ''}`}
                >
                  {m.role === 'assistant' ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-[7px] left-3 size-3 rotate-45 rounded-[1px] border-l-2 border-t-2 border-dashed border-accent/55 bg-[color-mix(in_srgb,var(--card-soft)_94%,transparent)]"
                    />
                  ) : null}
                  {m.content ? (
                    <MessageContent
                      text={m.content}
                      termDefs={termDefs}
                      onTermAction={onTermAction}
                      messageId={m.id}
                      markdown={m.role === 'assistant'}
                    />
                  ) : m.status === 'error' ? (
                    <span className="text-danger">回答未完成</span>
                  ) : null}
                  {m.status === 'error' && m.error ? (
                    <p className="mt-1 text-xs text-danger">{m.error}</p>
                  ) : null}
                  {m.role === 'assistant' && m.sources && m.sources.length > 0 ? (
                    <div className="mt-3 border-t border-dashed border-border pt-2">
                      <p className="text-[11px] font-semibold text-muted">引用来源</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.sources.map((source, index) => (
                          <a
                            key={source.id}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="doodle-link inline-flex max-w-56 items-center gap-1 rounded-[2px] border border-dashed border-border bg-card px-2 py-1 text-[11px] text-card-foreground hover:bg-highlight/15"
                          >
                            <span className="shrink-0">[{index + 1}]</span>
                            <span className="truncate">{source.title}</span>
                            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {/* 回复操作行：重新生成（仅最后一条）/ 详细综述 / 从这里分支——图标 + Tooltip */}
                {showActions ? (
                  <div className="mt-1 flex items-center gap-0.5 pl-1">
                    <MessageAction
                      icon={<RotateCcw aria-hidden="true" className="size-3" />}
                      title={m.id === lastAssistantId ? '重写这条回答' : '只有最后一条回答可以原位重新生成，更早的回答请用分支'}
                      disabled={m.id !== lastAssistantId}
                      onClick={onRegenerate}
                    />
                    <MessageAction
                      icon={<FileText aria-hidden="true" className="size-3" />}
                                      title="从这条回答派生分支，生成结构化的详细综述"
                      onClick={() => onSummarize(m.id, m.content)}
                    />
                    <MessageAction
                      icon={<GitBranch aria-hidden="true" className="size-3" />}
                                      title="从这条回答派生新分支继续提问"
                      onClick={() => onBranchFromMessage(m.id)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {isStreaming && (
          <div className="flex justify-start">
            <span className="text-xs text-muted">思考中…</span>
          </div>
        )}
      </div>

      {/* 输入区：上方紧凑工具条（风格 / 模型 / 引用资源 | 重新生成 / 继续回答），输入框与发送按钮同高 */}
      <div className="shrink-0 border-t border-dashed border-border p-3">
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
        {selectedResourceIds.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5" role="group" aria-label="本轮已选资源">
            {resourceOptions.filter((resource) => selectedResourceIds.includes(resource.id)).map((resource) => (
              <span key={resource.id} className="inline-flex max-w-56 rotate-[-0.35deg] items-center gap-1 rounded-[2px] border border-dashed border-primary/60 bg-primary/10 px-2 py-1 text-[11px] text-foreground shadow-[2px_2px_0_rgba(255,107,107,0.24)]">
                <span className="truncate">{resource.title}</span>
                <button type="button" aria-label={`移除资源 ${resource.title}`} onClick={() => onToggleResource(resource.id)} className="inline-flex size-6 items-center justify-center rounded-sm hover:bg-primary/10">
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {/* 输入框（外框承载边框/焦点态）：三个功能图标（风格/模型/引用资源）内嵌框内右侧；发送钮在框外 */}
        <div className="flex items-end gap-2">
          <div className="chat-input flex min-h-11 w-full min-w-0 flex-1 items-end gap-1 rounded-[2px] border-2 border-dashed border-border bg-card-soft pl-3.5 pr-1 shadow-[2px_2px_0_rgba(44,44,44,0.07)] transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[4px_4px_0_var(--marker-red)]">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
              className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none self-stretch overflow-y-auto bg-transparent py-2 text-sm leading-5 text-card-foreground outline-none placeholder:text-card-foreground/50"
            />
            {/* 功能图标组：内嵌输入框右内侧 */}
            <div className="flex h-11 shrink-0 items-center gap-0.5 self-end">
              <StyleSwitch value={styleOverride} fallback={fallbackStyle} onChange={onStyleChange} />
              <ModelToggle value={model} onChange={onModelChange} />
              <ResourceSelector
                resources={resourceOptions}
                selectedIds={selectedResourceIds}
                onToggle={onToggleResource}
              />
            </div>
          </div>
          {/* 发送：红底墨边主按钮（marker 黄硬影），带文字、高度与输入框一致（随内容增高拉伸） */}
          {isStreaming ? (
            <IconButton className="size-11" label="停止生成" onClick={onStop}>
              <Square aria-hidden="true" className="size-4 fill-current" />
            </IconButton>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="发送（Enter）"
                  onClick={onSend}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-[2px] border-2 border-dashed border-foreground bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[3px_3px_0_var(--marker-yellow)] transition-[transform,box-shadow] duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_var(--marker-yellow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                >
                  <SendHorizontal aria-hidden="true" className="size-4" />
                  发送
                </button>
              </TooltipTrigger>
              <TooltipContent>发送（Enter）</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

    </div>
  );
}

function ResourceSelector({
  resources,
  selectedIds,
  onToggle,
}: {
  resources: ChatResource[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* 图标触发 + 已选数角标，功能经 Tooltip 悬停显示 */}
        <IconButton
          label={selectedIds.length > 0 ? `引用资源（已选 ${selectedIds.length} 个）` : '引用资源'}
          className="relative size-7 [&_svg]:size-3.5"
        >
          <BookOpenText aria-hidden="true" />
          {selectedIds.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 rotate-[-2deg] rounded-[2px] border border-dashed border-border bg-card px-1 text-[9px] font-semibold leading-3.5 text-muted">
              {selectedIds.length}
            </span>
          ) : null}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start" side="top">
        <p className="px-2 py-1 text-xs font-semibold text-card-foreground">选择本轮使用的资源</p>
        <p className="px-2 pb-2 text-[11px] text-muted">最多 5 个，回答会显示对应引用来源。</p>
        <div className="max-h-64 overflow-y-auto">
          {resources.length === 0 ? (
            <p className="px-2 py-5 text-center text-xs text-muted">资源库中还没有可引用内容</p>
          ) : resources.map((resource) => {
            const selected = selectedIds.includes(resource.id);
            return (
              <button
                key={resource.id}
                type="button"
                onClick={() => onToggle(resource.id)}
                disabled={!selected && selectedIds.length >= 5}
                className="doodle-row flex w-full items-center gap-2 rounded-[2px] border border-dashed border-transparent px-2 py-2 text-left hover:bg-highlight/15 disabled:opacity-45"
              >
                <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {selected ? <Check aria-hidden="true" className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-card-foreground">{resource.title}</span>
                  <span className="block text-[11px] text-muted">{resource.type}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** 会话操作菜单（重命名 / 置顶 / 归档 / 删除）：与树气泡同款**悬停开关**
 * （悬停 180ms 开、移开 240ms 关、移进菜单停留、快扫不误触、触摸仍点击）。 */
function SessionOpsMenu({
  session,
  title,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  session: ChatSession;
  title: string;
  onRename: (title: string) => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(title);
  // 自持状态的悬停开关（180ms 开 / 240ms 关 / 移进菜单停留）
  const { open, setOpen, hoverOpen, hoverClose, hoverStay } = useHoverSwitch();

  return (
    // modal={false}：modal 下拉会给 body 挂 pointer-events:none，触发钮瞬间失 hover →
    // pointerleave 关菜单 → 恢复 hover 又开菜单，形成开-关抽搐循环；非 modal 无此问题
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton
          label="会话操作"
          tooltip={false}
          onPointerEnter={hoverOpen}
          onPointerLeave={(event) => hoverClose(event)}
        >
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onPointerEnter={hoverStay}
        onPointerLeave={(event) => hoverClose(event)}
      >
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

      {/* 重命名 / 删除对话框（原卡片内逻辑原样搬入） */}
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
    </DropdownMenu>
  );
}

/** 回复操作行按钮：图标 + Tooltip 悬停显示功能（IconButton 统一悬停样式）。 */
function MessageAction({
  icon,
  title,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <IconButton
      label={title}
      onClick={onClick}
      disabled={disabled}
      className="size-6 [&_svg]:size-3.5"
    >
      {icon}
    </IconButton>
  );
}

/** 模型单钮双态切换：闪电（v4-flash，默认）⇄ 深思（v4-pro），图标即状态——pro 换青色，无边框装饰。 */
function ModelToggle({
  value,
  onChange,
}: {
  value: ChatModel;
  onChange: (m: ChatModel) => void;
}) {
  const pro = value === 'pro';
  return (
    <IconButton
      aria-pressed={pro}
      label={pro ? '深思 · v4-pro 深度思考，点击切回闪电' : '闪电 · v4-flash 快速回复，点击切换深思'}
      className="size-7 [&_svg]:size-3.5"
      style={pro ? { color: 'var(--accent)' } : undefined}
      onClick={() => onChange(pro ? 'fast' : 'pro')}
    >
      {pro ? (
        <Sparkles aria-hidden="true" />
      ) : (
        <Zap aria-hidden="true" />
      )}
    </IconButton>
  );
}

/** 老师风格切换：图标触发（Tooltip 显示生效风格），菜单内保留文字说明。 */
function StyleSwitch({
  value,
  fallback,
  onChange,
}: {
  value: TeacherStyle | null;
  fallback: TeacherStyle;
  onChange: (next: TeacherStyle | null) => void;
}) {
  const effective = value ?? fallback;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={`老师风格：${teacherStyleLabel(effective)}${value ? '' : '（跟随全局默认）'}，点按切换`}
          className="size-7 [&_svg]:size-3.5"
        >
          <GraduationCap aria-hidden="true" className="text-primary" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TEACHER_STYLES.map((item) => (
          <DropdownMenuItem key={item.value} onSelect={() => onChange(item.value)}>
            {effective === item.value ? (
              <Check aria-hidden="true" className="size-3.5 text-primary" />
            ) : (
              <span aria-hidden className="size-3.5" />
            )}
            {item.label} · {item.tagline}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(null)}>
          {value === null ? (
            <Check aria-hidden="true" className="size-3.5 text-primary" />
          ) : (
            <span aria-hidden className="size-3.5" />
          )}
          跟随全局默认（{teacherStyleLabel(fallback)}）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
