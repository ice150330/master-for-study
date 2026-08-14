'use client';

import {
  ArrowRight,
  BookOpenCheck,
  BookOpenText,
  Clock3,
  MessageCircle,
  NotebookPen,
  SquareTerminal,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { IconButton } from '@/components/ui/IconButton';
import type { TodayLearningAction } from '@/lib/db';

const LATER_KEY = 'mentor-today-later';
const LATER_EVENT = 'mentor-today-later-change';

function subscribeLater(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(LATER_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(LATER_EVENT, callback);
  };
}

const iconByKind = {
  continue: MessageCircle,
  review: BookOpenCheck,
  practice: SquareTerminal,
  resource: BookOpenText,
  note: NotebookPen,
};

export function TodayView({ initialActions }: { initialActions: TodayLearningAction[] }) {
  const laterRaw = useSyncExternalStore(
    subscribeLater,
    () => localStorage.getItem(LATER_KEY) ?? '[]',
    () => '[]',
  );
  const laterIds = useMemo(() => {
    try {
      const saved = JSON.parse(laterRaw);
      return Array.isArray(saved) ? saved.filter((value) => typeof value === 'string') : [];
    } catch {
      return [];
    }
  }, [laterRaw]);

  const visible = useMemo(
    () => initialActions.filter((action) => !laterIds.includes(action.id)),
    [initialActions, laterIds],
  );

  function defer(actionId: string) {
    const next = [...new Set([...laterIds, actionId])];
    localStorage.setItem(LATER_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(LATER_EVENT));
  }

  function restore() {
    localStorage.removeItem(LATER_KEY);
    window.dispatchEvent(new Event(LATER_EVENT));
  }

  return (
    <PageShell title="今日学习" description="从真实学习记录中选择下一步，不生成虚构计划" width="lg">
      {visible.length === 0 ? (
        <div className="border-y border-border py-16 text-center">
          <BookOpenCheck aria-hidden="true" className="mx-auto size-7 text-accent" />
          <h2 className="mt-3 text-base font-semibold text-foreground">今天的行动已处理</h2>
          <p className="mt-1 text-sm text-muted">稍后项目仍保留在本机，可以随时恢复。</p>
          <button
            type="button"
            onClick={restore}
            className="mt-5 text-sm font-medium text-primary hover:underline"
          >
            恢复稍后项目
          </button>
        </div>
      ) : (
        <div className="border-y border-border">
          {visible.map((action, index) => {
            const Icon = iconByKind[action.kind];
            return (
              <article
                key={action.id}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-5 last:border-b-0"
              >
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-md ${
                    index === 0 ? 'bg-primary/12 text-primary' : 'bg-card-soft text-muted'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">{action.title}</h2>
                    <span className="shrink-0 text-[11px] text-muted">{action.effort}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{action.description}</p>
                  <p className="mt-1.5 text-[11px] text-muted/80">{action.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label={`今天稍后处理：${action.title}`} onClick={() => defer(action.id)}>
                    <Clock3 aria-hidden="true" />
                  </IconButton>
                  <Link
                    href={action.href}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-[filter] hover:brightness-95"
                  >
                    {action.actionLabel}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
