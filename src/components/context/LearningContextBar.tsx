'use client';

import { ArrowLeft, ChevronRight, CircleDot, Database, Link2, X } from 'lucide-react';
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

export function LearningContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const context = useMemo(() => parseLearningContext(searchParams), [searchParams]);
  const [conceptLabel, setConceptLabel] = useState<{ id: string; name: string } | null>(null);
  const serialized = searchParams.toString();
  const currentHref = `${pathname}${serialized ? `?${serialized}` : ''}`;
  const visible = Boolean(context.conceptId || context.source || context.attempt);

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

  if (!visible) return null;
  const activeItem = findActiveItem(pathname);
  const conceptHref = context.conceptId
    ? withLearningContext('/', { ...context, attempt: null })
    : null;

  return (
    <div data-testid="learning-context-bar" className="paper-control animate-ui-enter relative z-[9] flex h-9 shrink-0 items-center gap-2 border-b border-dashed border-border px-3 text-card-foreground md:px-5">
      <IconButton className="size-7" label="返回上一学习位置" onClick={() => router.back()}>
        <ArrowLeft aria-hidden="true" />
      </IconButton>
      <Database aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
      <span className="hidden text-[10px] font-medium text-muted min-[900px]:inline">
        {context.workspaceId ? '工作区上下文' : '本地工作区'}
      </span>
      <ChevronRight aria-hidden="true" className="hidden size-3 text-muted min-[900px]:block" />
      <nav aria-label="学习上下文路径" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[11px]">
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
            <Link href={conceptHref} className="marker-highlight max-w-56 truncate font-semibold text-foreground">
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
      {context.source ? (
        <Link href={sourceHref(context.source, context)} className="doodle-link hidden shrink-0 text-[11px] font-semibold text-foreground min-[900px]:inline">
          返回来源
        </Link>
      ) : null}
      <IconButton
        className="size-7"
        label="退出当前学习上下文"
        onClick={() => router.replace(withoutLearningContext(currentHref))}
      >
        <X aria-hidden="true" />
      </IconButton>
    </div>
  );
}
