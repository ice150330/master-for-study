'use client';

import {
  ArrowRight,
  BookOpenCheck,
  BookOpenText,
  ClipboardCheck,
  Clock3,
  Flag,
  ListTodo,
  MessageCircle,
  NotebookPen,
} from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { EmptyState } from '@/components/ui/StatePanel';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { MetaChip } from '@/components/ui/MetaChip';
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
  interview: ClipboardCheck,
  resource: BookOpenText,
  note: NotebookPen,
};

export function TodayView({
  initialActions,
  goal,
}: {
  initialActions: TodayLearningAction[];
  goal?: string | null;
}) {
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
    <PageShell
      pageKey="today"
      width="lg"
      meta={(
        <>
          <MetaChip icon={<ListTodo aria-hidden="true" />}>{visible.length} 项行动</MetaChip>
          {goal ? (
            <MetaChip icon={<Flag aria-hidden="true" />} tone="accent">成长目标 · {goal}</MetaChip>
          ) : null}
        </>
      )}
    >
      {visible.length === 0 ? (
        <EmptyState
          title="今天的行动已处理"
          description="稍后项目仍保留在本机，可以随时恢复。"
          icon={<BookOpenCheck aria-hidden="true" />}
          actionLabel="恢复稍后项目"
          onAction={restore}
        />
      ) : (
        <div className="grid gap-2">
          {visible.map((action, index) => {
            const Icon = iconByKind[action.kind];
            return (
              <article
                key={action.id}
                className="doodle-row paper-subtle grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-4 rounded-[2px] border border-dashed px-3 py-3.5"
              >
                <span
                  className={`inline-flex size-9 rotate-[-1deg] items-center justify-center rounded-[2px] border border-dashed ${
                    index === 0 ? 'border-primary bg-primary/12 text-primary shadow-[3px_3px_0_var(--marker-yellow)]' : 'border-border bg-card text-muted shadow-[2px_2px_0_rgba(78,205,196,0.28)]'
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
                  <p className="mt-1.5 text-[11px] text-muted">{action.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label={`今天稍后处理：${action.title}`} onClick={() => defer(action.id)}>
                    <Clock3 aria-hidden="true" />
                  </IconButton>
                  <LinkButton href={action.href}>
                    {action.actionLabel}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </LinkButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
