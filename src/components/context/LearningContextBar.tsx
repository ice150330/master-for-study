'use client';

import { ChevronRight, CircleDot, Database, FolderTree, Link2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { requestJson } from '@/lib/http/client';
import {
  attemptHref,
  parseLearningContext,
  sourceHref,
  withLearningContext,
} from '@/lib/learning-context';
import { findActiveItem } from '@/lib/nav';
import { selectTrailSession, subscribeSessionTrail, getSessionTrail } from '@/lib/session-trail';

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
 * 底部状态条（常驻，h-8）：**会话树路径追踪**——像目录一样显示 根 → … → 当前会话
 * 的完整血缘路径，点击任意上游会话直接切换；右侧保留学习上下文（来源 / 概念 / 作答）
 * 的紧凑指示。不在会话页时回退为 工作区 · 学习上下文 · 当前位置。路径数据来自
 * session-trail store（Chat 写入，`useSyncExternalStore` 引用稳定）。
 */
export function LearningContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const context = useMemo(() => parseLearningContext(searchParams), [searchParams]);
  const trail = useSyncExternalStore(subscribeSessionTrail, getSessionTrail, () => null);
  const [conceptLabel, setConceptLabel] = useState<{ id: string; name: string } | null>(null);

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

  /** 点击路径段：会话页内直接切换，其他页面带着 session 参数跳回会话页。 */
  function jumpToSession(id: string) {
    if (pathname === '/' && selectTrailSession(id)) return;
    router.push(`/?session=${id}`);
  }

  return (
    <div
      data-testid="learning-context-bar"
      className="animate-ui-enter mb-14 flex h-8 shrink-0 items-center gap-1.5 border-t border-dashed border-border bg-card px-3 text-[11px] text-card-foreground md:mb-0 md:px-5"
    >
      {trail && trail.path.length > 0 ? (
        <nav aria-label="会话树路径" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <FolderTree aria-hidden="true" className="size-3 shrink-0 text-primary" />
          {trail.path.map((item, index) => {
            const isCurrent = item.id === trail.currentId;
            const isParent = index === trail.path.length - 2;
            // 窄屏只保留父级与当前，更上游的层级收起来
            const hiddenOnNarrow = index < trail.path.length - 2;
            return (
              <Fragment key={item.id}>
                {index > 0 ? <span aria-hidden className="shrink-0 text-muted">/</span> : null}
                <button
                  type="button"
                  onClick={() => jumpToSession(item.id)}
                  disabled={isCurrent}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={`D${item.depth} · ${item.title}${isCurrent ? '（当前会话）' : '，点击切换'}`}
                  className={`inline-flex min-h-6 min-w-0 items-center truncate transition-colors ${
                    hiddenOnNarrow ? 'hidden md:inline-flex md:max-w-32' : 'max-w-40'
                  } ${isParent && !isCurrent ? 'inline-flex' : ''} ${
                    isCurrent
                      ? 'marker-highlight font-bold text-foreground'
                      : 'text-muted hover:text-foreground underline decoration-dotted decoration-border underline-offset-4 hover:decoration-accent'
                  }`}
                >
                  {item.title}
                </button>
              </Fragment>
            );
          })}
          {trail.branchCount > 0 ? (
            <span className="ml-1 hidden shrink-0 text-muted sm:inline">· {trail.branchCount} 分支</span>
          ) : null}
        </nav>
      ) : (
        <nav aria-label="学习上下文路径" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <Database aria-hidden="true" className="size-3 shrink-0 text-accent" />
          <span className="hidden shrink-0 text-[10px] font-medium text-muted lg:inline">
            {context.workspaceId ? '工作区上下文' : '本地工作区'}
          </span>
          <ChevronRight aria-hidden="true" className="hidden size-3 shrink-0 text-muted lg:block" />
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
      )}

      <span className="hidden shrink-0 text-[10px] text-muted md:inline">路径随会话切换更新</span>
    </div>
  );
}
