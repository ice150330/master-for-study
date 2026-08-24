'use client';

import { ChevronRight, CircleDot, Database, Link2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { requestJson } from '@/lib/http/client';
import {
  attemptHref,
  parseLearningContext,
  sourceHref,
  withLearningContext,
  withoutLearningContext,
} from '@/lib/learning-context';
import { findActiveItem } from '@/lib/nav';

const sourceLabels = {
  message: '对话片段',
  note: '学习笔记',
  resource: '学习资料',
};

const attemptLabels = {
  practice: '实践尝试',
  interview: '面试作答',
  review: '复习记录',
};

/**
 * 学习上下文条（常驻页底）：工作区 → 来源 → 概念 → 作答 → 当前位置的面包屑。
 * 无上下文时收成一行工作区与当前位置——不再只在带参时出现，
 * 让"我在哪、上下文从哪来"始终可见且不占工作高度（h-8 紧凑条）。
 */
export function LearningContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const context = useMemo(() => parseLearningContext(searchParams), [searchParams]);
  const [conceptLabel, setConceptLabel] = useState<{ id: string; name: string } | null>(null);
  const serialized = searchParams.toString();
  const currentHref = `${pathname}${serialized ? `?${serialized}` : ''}`;
  const hasContext = Boolean(context.conceptId || context.source || context.attempt);

  useEffect(() => {
    if (!context.conceptId) return;
    const controller = new AbortController();
    const conceptId = context.conceptId;
    void requestJson<{ concept: { canonicalName: string; name: string } }>(
      `/api/concepts?id=${encodeURIComponent(conceptId)}`,
      { signal: controller.signal },
    ).then((detail) => {
      setConceptLabel({ id: conceptId, name: detail.concept.canonicalName || detail.concept.name });
    }).catch(() => {
      if (!controller.signal.aborted) setConceptLabel({ id: conceptId, name: '当前概念' });
    });
    return () => controller.abort();
  }, [context.conceptId]);

  const activeItem = findActiveItem(pathname);
  const conceptHref = context.conceptId
    ? withLearningContext('/', { ...context, attempt: null })
    : null;

  return (
    <div
      data-testid="learning-context-bar"
      className="animate-ui-enter mb-14 flex h-8 shrink-0 items-center gap-1.5 border-t border-dashed border-border bg-card px-3 text-[11px] text-card-foreground md:mb-0 md:px-5"
    >
      <Database aria-hidden="true" className="size-3 shrink-0 text-accent" />
      <span className="hidden shrink-0 text-[10px] font-medium text-muted lg:inline">
        {context.workspaceId ? '工作区上下文' : '本地工作区'}
      </span>
      <ChevronRight aria-hidden="true" className="hidden size-3 shrink-0 text-muted lg:block" />
      <nav aria-label="学习上下文路径" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {context.source ? (
          <>
            <Link href={sourceHref(context.source, context)} className="doodle-link inline-flex shrink-0 items-center gap-1 text-muted hover:text-foreground">
              <Link2 aria-hidden="true" className="size-3" />{sourceLabels[context.source.type]}
            </Link>
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted" />
          </>
        ) : null}
        {context.conceptId && conceptHref ? (
          <>
            <Link href={conceptHref} className="marker-highlight max-w-48 truncate font-semibold text-foreground">
              {conceptLabel?.id === context.conceptId ? conceptLabel.name : '读取概念…'}
            </Link>
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted" />
          </>
        ) : null}
        {context.attempt ? (
          <>
            <Link href={attemptHref(context.attempt, context)} className="doodle-link inline-flex shrink-0 items-center gap-1 text-muted hover:text-foreground">
              <CircleDot aria-hidden="true" className="size-3" />{attemptLabels[context.attempt.type]}
            </Link>
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted" />
          </>
        ) : null}
        <span className="truncate font-semibold text-card-foreground">{activeItem?.label ?? '学习工作台'}</span>
      </nav>
      {hasContext ? (
        <>
          {context.source ? (
            <Link href={sourceHref(context.source, context)} className="doodle-link hidden shrink-0 font-semibold text-foreground min-[900px]:inline">
              返回来源
            </Link>
          ) : null}
          <IconButton
            className="size-6 [&_svg]:size-3.5"
            label="退出当前学习上下文"
            onClick={() => router.replace(withoutLearningContext(currentHref))}
          >
            <X aria-hidden="true" />
          </IconButton>
        </>
      ) : (
        <span className="hidden shrink-0 text-[10px] text-muted md:inline">上下文随跳转保留</span>
      )}
    </div>
  );
}
