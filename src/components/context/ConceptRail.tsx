'use client';

import {
  BookOpenText,
  ClipboardCheck,
  ExternalLink,
  EyeOff,
  LoaderCircle,
  MapPin,
  MessageCircleMore,
  NotebookPen,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { contextFocusRef, withLearningContext, type LearningContext } from '@/lib/learning-context';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { requestJson } from '@/lib/http/client';
import { addTermToBlacklist } from '@/lib/term-blacklist';

export type ConceptDetail = {
  concept: {
    id: string;
    name: string;
    canonicalName: string;
    aliases: string[];
    definition: string;
    example: string | null;
    confidence: number;
  };
  mastery: {
    state: 'new' | 'learning' | 'reviewing' | 'relearning';
    queueStatus?: 'pending' | 'active' | 'dismissed';
  } | null;
  mentions: Array<{
    id: string;
    sourceType: 'message' | 'note' | 'resource';
    sourceId: string;
    sessionId: string | null;
    excerpt: string | null;
    sourceTitle: string;
  }>;
  relatedNotes: Array<{ id: string; title: string; sessionId: string | null }>;
  relatedResources: Array<{ id: string; title: string; url: string; status: string }>;
};

const masteryLabel = {
  new: '新发现',
  learning: '学习中',
  reviewing: '复习中',
  relearning: '再学习',
};

export function ConceptRail({
  name,
  detail,
  loading,
  error,
  onClose,
  onFollowup,
  onOpenSource,
  onRefresh,
  learningContext,
}: {
  name: string;
  detail: ConceptDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onFollowup: () => void;
  onOpenSource: (source: ConceptDetail['mentions'][number]) => void;
  /** 队列状态变更后重载详情 */
  onRefresh?: () => void;
  learningContext: LearningContext;
}) {
  const toast = useToast();
  const [queueBusy, setQueueBusy] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState<string | null>(null);
  const [definitionBusy, setDefinitionBusy] = useState(false);
  const concept = detail?.concept;
  const queueStatus = detail?.mastery?.queueStatus ?? (detail?.mastery ? 'active' : 'pending');

  /** B2 定义修正：保存后经 onRefresh 重载详情，复习卡 / 知识图动态联动。 */
  async function saveDefinition() {
    if (!concept || definitionDraft === null || definitionBusy) return;
    const next = definitionDraft.trim();
    if (next.length < 4) {
      toast({ title: '定义太短', description: '至少 4 个字符', tone: 'error' });
      return;
    }
    setDefinitionBusy(true);
    try {
      await requestJson(`/api/concepts/${concept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition: next }),
      });
      setDefinitionDraft(null);
      toast({ title: '定义已修正', tone: 'success' });
      onRefresh?.();
    } catch {
      toast({ title: '定义保存失败', description: '请稍后重试', tone: 'error' });
    } finally {
      setDefinitionBusy(false);
    }
  }

  /** A2 队列治理：确认入队 / 移出 / 恢复。 */
  async function setQueueStatus(next: 'active' | 'dismissed') {
    if (!concept || queueBusy) return;
    setQueueBusy(true);
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue',
          termId: concept.id,
          queueStatus: next,
          idempotencyKey: createIdempotencyKey('review-queue'),
        }),
      });
      toast({ title: next === 'active' ? '已加入复习队列' : '已移出复习队列', tone: 'success' });
      onRefresh?.();
    } catch {
      toast({ title: '队列状态更新失败', description: '请稍后重试', tone: 'error' });
    } finally {
      setQueueBusy(false);
    }
  }
  return (
    <div
      data-context-focus={contextFocusRef(learningContext) ?? undefined}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className="flex h-full min-h-0 flex-col bg-card outline-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-dashed border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted">知识对象</p>
          <h2 className="doodle-heading mt-0.5 truncate text-base font-extrabold text-card-foreground">
            {concept?.canonicalName || name}
          </h2>
        </div>
        <IconButton label="关闭概念详情" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            正在整理定义与来源
          </div>
        ) : error ? (
          <p className="py-8 text-sm text-danger">{error}</p>
        ) : concept ? (
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rotate-[-1deg] rounded-[2px] border border-dashed border-accent bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent-foreground shadow-[2px_2px_0_rgba(78,205,196,0.28)]">
                  {detail?.mastery ? masteryLabel[detail.mastery.state] : '待加入'}
                </span>
                {queueStatus === 'pending' ? (
                  <span className="rounded-[2px] border border-dashed border-primary px-2 py-1 text-[11px] font-semibold text-primary">
                    待确认入队
                  </span>
                ) : queueStatus === 'dismissed' ? (
                  <span className="rounded-[2px] border border-dashed border-border px-2 py-1 text-[11px] text-muted">
                    已移出复习
                  </span>
                ) : null}
                <span className="text-[11px] text-muted">
                  置信度 {Math.round(concept.confidence * 100)}%
                </span>
              </div>
              {definitionDraft === null ? (
                <p className="text-sm leading-6 text-card-foreground">{concept.definition}</p>
              ) : (
                <div className="space-y-2">
                  <textarea
                    aria-label="修正概念定义"
                    value={definitionDraft}
                    onChange={(event) => setDefinitionDraft(event.target.value)}
                    rows={4}
                    className="paper-subtle w-full resize-none rounded-[2px] border-2 border-dashed border-border bg-background p-2.5 text-sm leading-6 text-card-foreground outline-none focus:border-accent"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDefinitionDraft(null)} disabled={definitionBusy}>
                      取消
                    </Button>
                    <Button size="sm" onClick={() => void saveDefinition()} loading={definitionBusy}>
                      保存定义
                    </Button>
                  </div>
                </div>
              )}
              {definitionDraft === null ? (
                <button
                  type="button"
                  onClick={() => setDefinitionDraft(concept.definition)}
                  className="doodle-link mt-1 inline-flex items-center gap-1 text-[11px] text-muted"
                >
                  <Pencil aria-hidden="true" className="size-3" />
                  修正定义
                </button>
              ) : null}
              {concept.example ? (
                <p className="mt-2 border-l-2 border-dashed border-accent/60 pl-3 text-xs leading-5 text-muted">
                  {concept.example}
                </p>
              ) : null}
              {concept.aliases.length > 0 ? (
                <p className="mt-2 text-xs text-muted">别名：{concept.aliases.join('、')}</p>
              ) : null}
            </section>

            <RailSection title="来源" icon={<MapPin aria-hidden="true" />}>
              {detail?.mentions.length ? (
                <div className="space-y-1">
                  {detail.mentions.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => onOpenSource(source)}
                      className="doodle-row w-full rounded-[2px] border border-dashed border-transparent px-2 py-2 text-left"
                    >
                      <span className="block truncate text-xs font-medium text-card-foreground">
                        {source.sourceTitle}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">
                        {source.excerpt || '打开来源位置'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">当前解释尚未建立来源锚点。</p>
              )}
            </RailSection>

            {detail?.relatedNotes.length ? (
              <RailSection title="相关笔记" icon={<NotebookPen aria-hidden="true" />}>
                {detail.relatedNotes.map((note) => (
                  <a
                    key={note.id}
                    href={withLearningContext(`/notes?note=${note.id}`, {
                      ...learningContext,
                      conceptId: concept.id,
                      source: { type: 'note', id: note.id },
                      attempt: null,
                    })}
                    className="doodle-link block truncate rounded-[2px] px-2 py-1.5 text-xs text-card-foreground hover:bg-highlight/15"
                  >
                    {note.title}
                  </a>
                ))}
              </RailSection>
            ) : null}

            {detail?.relatedResources.length ? (
              <RailSection title="相关资源" icon={<BookOpenText aria-hidden="true" />}>
                {detail.relatedResources.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="doodle-link flex items-center justify-between gap-2 rounded-[2px] px-2 py-1.5 text-xs text-card-foreground hover:bg-highlight/15"
                  >
                    <span className="truncate">{resource.title}</span>
                    <ExternalLink aria-hidden="true" className="size-3 shrink-0 text-muted" />
                  </a>
                ))}
              </RailSection>
            ) : null}
          </div>
        ) : null}
      </div>

      {concept ? (
        <div className="shrink-0 border-t border-dashed border-border p-4">
          <Button className="w-full" onClick={onFollowup}>
            <MessageCircleMore aria-hidden="true" className="size-4" />
            继续追问
          </Button>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <RailLink href={withLearningContext('/notes', { ...learningContext, conceptId: concept.id, attempt: null })} label="创建笔记" icon={<NotebookPen />} />
            <RailLink href={withLearningContext('/interview', { ...learningContext, conceptId: concept.id, attempt: null })} label="模拟测验" icon={<ClipboardCheck />} />
            {queueStatus === 'active' ? (
              <RailLink href={withLearningContext('/review', { ...learningContext, conceptId: concept.id, attempt: null })} label="去复习" icon={<BookOpenText />} />
            ) : (
              <RailButton
                label={queueStatus === 'dismissed' ? '恢复复习' : '确认入队'}
                icon={queueStatus === 'dismissed' ? <RotateCcw /> : <BookOpenText />}
                busy={queueBusy}
                onClick={() => void setQueueStatus('active')}
              />
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {queueStatus !== 'dismissed' ? (
              <RailButton label="移出复习" icon={<Trash2 />} busy={queueBusy} onClick={() => void setQueueStatus('dismissed')} />
            ) : null}
            <RailButton
              label="不再高亮"
              icon={<EyeOff />}
              onClick={() => {
                addTermToBlacklist(concept.canonicalName || concept.name);
                toast({ title: `已不再高亮「${concept.canonicalName || concept.name}」`, tone: 'success' });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-dashed border-border pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-card-foreground [&_svg]:size-3.5">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function RailLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="doodle-row flex min-h-14 flex-col items-center justify-center gap-1 rounded-[2px] border border-dashed border-border bg-card-soft px-1 text-center text-[11px] text-card-foreground hover:bg-highlight/15 [&_svg]:size-3.5"
    >
      {icon}
      {label}
    </a>
  );
}

/** 与 RailLink 同视觉的动作按钮（队列治理 / 黑名单）。 */
function RailButton({
  label,
  icon,
  onClick,
  busy = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="doodle-row flex min-h-10 flex-col items-center justify-center gap-1 rounded-[2px] border border-dashed border-border bg-card-soft px-1 text-center text-[11px] text-card-foreground hover:bg-highlight/15 disabled:opacity-50 [&_svg]:size-3.5"
    >
      {icon}
      {label}
    </button>
  );
}
