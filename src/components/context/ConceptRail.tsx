'use client';

import {
  BookOpenText,
  Brain,
  ExternalLink,
  LoaderCircle,
  MapPin,
  MessageCircleMore,
  NotebookPen,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { contextFocusRef, withLearningContext, type LearningContext } from '@/lib/learning-context';

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
  mastery: { state: 'new' | 'learning' | 'reviewing' | 'relearning' } | null;
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
  learningContext,
}: {
  name: string;
  detail: ConceptDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onFollowup: () => void;
  onOpenSource: (source: ConceptDetail['mentions'][number]) => void;
  learningContext: LearningContext;
}) {
  const concept = detail?.concept;
  return (
    <div
      data-context-focus={contextFocusRef(learningContext) ?? undefined}
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col bg-card outline-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted">知识对象</p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-card-foreground">
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
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent">
                  {detail?.mastery ? masteryLabel[detail.mastery.state] : '待加入'}
                </span>
                <span className="text-[11px] text-muted">
                  置信度 {Math.round(concept.confidence * 100)}%
                </span>
              </div>
              <p className="text-sm leading-6 text-card-foreground">{concept.definition}</p>
              {concept.example ? (
                <p className="mt-2 border-l-2 border-accent/50 pl-3 text-xs leading-5 text-muted">
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
                      className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-card-soft"
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
                    className="block truncate rounded-md px-2 py-1.5 text-xs text-card-foreground hover:bg-card-soft"
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
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-card-foreground hover:bg-card-soft"
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
        <div className="shrink-0 border-t border-border p-4">
          <Button className="w-full" onClick={onFollowup}>
            <MessageCircleMore aria-hidden="true" className="size-4" />
            继续追问
          </Button>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <RailLink href={withLearningContext('/notes', { ...learningContext, conceptId: concept.id, attempt: null })} label="创建笔记" icon={<NotebookPen />} />
            <RailLink href={withLearningContext('/practice', { ...learningContext, conceptId: concept.id, attempt: null })} label="开始练习" icon={<Brain />} />
            <RailLink href={withLearningContext('/review', { ...learningContext, conceptId: concept.id, attempt: null })} label="加入复习" icon={<BookOpenText />} />
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
    <section className="border-t border-border pt-4">
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
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md bg-card-soft px-1 text-center text-[11px] text-card-foreground transition-colors hover:bg-surface [&_svg]:size-3.5"
    >
      {icon}
      {label}
    </a>
  );
}
