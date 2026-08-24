'use client';

import Link from 'next/link';
import {
  Brain,
  Check,
  CircleAlert,
  Clock3,
  Flag,
  Keyboard,
  Link2,
  Mic,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';

type Grade = 'again' | 'hard' | 'good' | 'easy';
type AnswerMode = 'typed' | 'oral';

type ReviewItem = {
  cardId: string;
  termId: string;
  name: string;
  definition: string;
  state: 'new' | 'learning' | 'reviewing' | 'relearning';
  stability: number;
  difficulty: number;
  dueAt: string;
  isDifficult: boolean;
  sourceLabel: string;
  sourceHref: string;
  preview: Record<Grade, {
    dueAt: string;
    intervalMs: number;
    intervalLabel: string;
    scheduledDays: number;
  }>;
};

type ReviewQueue = {
  reviews: ReviewItem[];
  summary: { due: number; overdue: number; estimatedMinutes: number };
};

type LastReview = {
  logId: string;
  item: ReviewItem;
  intervalLabel: string;
};

type FocusReview = {
  id: string;
  termId: string;
  termName: string;
  rating: Grade;
  reviewAt: string;
  scheduledDays: number;
};

const GRADE_OPTIONS: Array<{
  grade: Grade;
  label: string;
  description: string;
  className: string;
}> = [
  { grade: 'again', label: '忘记', description: '没有想起来', className: 'border-pink/45 hover:bg-pink/10' },
  { grade: 'hard', label: '困难', description: '想起但不完整', className: 'border-yellow/60 hover:bg-yellow/10' },
  { grade: 'good', label: '记得', description: '核心内容正确', className: 'border-accent/45 hover:bg-accent/10' },
  { grade: 'easy', label: '熟练', description: '快速且完整', className: 'border-primary/45 hover:bg-primary/10' },
];

const STATE_LABELS: Record<ReviewItem['state'], string> = {
  new: '新卡',
  learning: '学习中',
  reviewing: '稳定复习',
  relearning: '重新学习',
};

export function ReviewView({
  initialQueue,
  focusReview = null,
}: {
  initialQueue: ReviewQueue;
  focusReview?: FocusReview | null;
}) {
  const toast = useToast();
  const [queue, setQueue] = useState(initialQueue.reviews);
  const [summary, setSummary] = useState(initialQueue.summary);
  const [completed, setCompleted] = useState(0);
  const [mode, setMode] = useState<AnswerMode>('typed');
  const [recall, setRecall] = useState('');
  const [oralDone, setOralDone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastReview, setLastReview] = useState<LastReview | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void; label: string } | null>(null);
  const startedAt = useRef(Date.now());

  const current = queue[0];
  const readyToReveal = mode === 'typed' ? recall.trim().length > 0 : oralDone;
  const totalInSession = completed + queue.length;

  function resetCard() {
    setRecall('');
    setOralDone(false);
    setRevealed(false);
    startedAt.current = Date.now();
  }

  async function grade(rating: Grade, previousIdempotencyKey?: string) {
    if (!current || busy || !revealed) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('review');
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{
        next: { logId: string; intervalLabel: string };
      }>('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          termId: current.termId,
          grade: rating,
          answerMode: mode,
          recallText: mode === 'typed' ? recall.trim() : null,
          durationMs: Date.now() - startedAt.current,
          idempotencyKey,
        }),
      });
      setQueue((items) => items.slice(1));
      setCompleted((count) => count + 1);
      setSummary((value) => {
        const due = Math.max(0, value.due - 1);
        return {
          ...value,
          due,
          overdue: isOverdue(current.dueAt) ? Math.max(0, value.overdue - 1) : value.overdue,
          estimatedMinutes: due === 0 ? 0 : Math.max(1, Math.ceil(due * 0.75)),
        };
      });
      setLastReview({ logId: data.next.logId, item: current, intervalLabel: data.next.intervalLabel });
      resetCard();
      toast({ title: `已安排在 ${data.next.intervalLabel}后`, tone: 'success' });
    } catch (error) {
      setError({
        message: getErrorMessage(error, '复习结果提交失败'),
        retry: () => grade(rating, idempotencyKey),
        label: '重新提交',
      });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!lastReview || busy) return;
    const target = lastReview;
    setBusy(true);
    setError(null);
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo',
          reviewLogId: target.logId,
          idempotencyKey: createIdempotencyKey('review-undo'),
        }),
      });
      setQueue((items) => [target.item, ...items]);
      setCompleted((count) => Math.max(0, count - 1));
      setSummary((value) => {
        const due = value.due + 1;
        return {
          ...value,
          due,
          overdue: isOverdue(target.item.dueAt) ? value.overdue + 1 : value.overdue,
          estimatedMinutes: Math.max(1, Math.ceil(due * 0.75)),
        };
      });
      setLastReview(null);
      resetCard();
      toast({ title: '已撤销上次评级', tone: 'success' });
    } catch (error) {
      setError({ message: getErrorMessage(error, '撤销失败'), retry: undo, label: '再次撤销' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleDifficult() {
    if (!current || busy) return;
    const difficult = !current.isDifficult;
    setBusy(true);
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'flag',
          termId: current.termId,
          difficult,
          idempotencyKey: createIdempotencyKey('review-flag'),
        }),
      });
      setQueue((items) => items.map((item, index) => index === 0 ? { ...item, isDifficult: difficult } : item));
    } catch (error) {
      setError({ message: getErrorMessage(error, '困难卡状态更新失败'), retry: toggleDifficult, label: '重试' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const element = document.activeElement?.tagName;
      const editing = element === 'INPUT' || element === 'TEXTAREA';
      if (!editing && event.key === ' ' && current && readyToReveal && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      if (!editing && revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void grade(GRADE_OPTIONS[Number(event.key) - 1].grade);
      }
      if (!editing && event.key.toLocaleLowerCase() === 'z' && lastReview) {
        event.preventDefault();
        void undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <PageShell title="复习" width="lg">
      <section className="mb-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-5 border-y border-dashed border-border py-3 text-sm">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>今日进度</span>
            <span>{completed} / {totalInSession}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[1px] border border-dashed border-border bg-surface">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${totalInSession === 0 ? 100 : (completed / totalInSession) * 100}%` }}
            />
          </div>
        </div>
        <Metric icon={<Brain />} label="待复习" value={`${summary.due} 张`} />
        <Metric icon={<CircleAlert />} label="已逾期" value={`${summary.overdue} 张`} tone={summary.overdue > 0 ? 'warning' : undefined} />
        <Metric icon={<Clock3 />} label="预计" value={`${summary.estimatedMinutes} 分钟`} />
      </section>

      {focusReview ? (
        <section
          data-context-focus={`review:${focusReview.id}`}
          tabIndex={-1}
          className="mb-4 flex rotate-[-0.15deg] items-center justify-between gap-4 rounded-[2px] border-2 border-dashed border-primary/55 bg-primary/8 px-4 py-3 shadow-[3px_3px_0_rgba(255,107,107,0.24)] outline-none"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">历史记录：{focusReview.termName}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              评级 {focusReview.rating} · 当次安排 {focusReview.scheduledDays} 天后复习
            </p>
          </div>
          <time className="shrink-0 text-[10px] text-muted">{new Date(focusReview.reviewAt).toLocaleString('zh-CN')}</time>
        </section>
      ) : null}

      {lastReview ? (
        <div className="mb-4 flex rotate-[0.15deg] items-center justify-between gap-4 rounded-[2px] border border-dashed border-accent/60 bg-accent/8 px-4 py-2.5 text-sm shadow-[3px_3px_0_rgba(78,205,196,0.22)]">
          <span><strong>{lastReview.item.name}</strong> 已安排在 {lastReview.intervalLabel}后</span>
          <Button variant="ghost" size="sm" onClick={undo} loading={busy}>
            <RotateCcw className="size-4" />撤销
          </Button>
        </div>
      ) : null}

      {error ? (
        <InlineNotice
          className="mb-4"
          tone="error"
          title="复习进度未更新"
          description={`${error.message}。当前回忆和答案仍保留。`}
          actionLabel={error.label}
          onAction={error.retry}
        />
      ) : null}

      {!current ? (
        <section className="paper-panel flex min-h-[430px] rotate-[-0.1deg] flex-col items-center justify-center rounded-[2px] border-2 border-dashed px-8 text-center">
          <span className="mb-4 grid size-11 rotate-[-2deg] place-items-center rounded-[2px] border-2 border-dashed border-accent bg-accent/12 text-accent-foreground shadow-[3px_3px_0_var(--marker-yellow)]"><Check className="size-5" /></span>
          <h2 className="doodle-heading text-lg font-extrabold">本轮复习完成</h2>
          <p className="mt-2 max-w-md text-sm text-muted">今日到期内容已处理完。</p>
          <Link
            href="/"
            className="doodle-action mt-6 inline-flex h-9 items-center justify-center rounded-[2px] border-2 border-dashed border-foreground bg-card px-4 text-sm font-semibold text-foreground hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            继续学习
          </Link>
        </section>
      ) : (
        <section className="paper-panel grid min-h-[320px] overflow-hidden rounded-[2px] border-2 border-dashed min-[960px]:grid-cols-[minmax(0,1fr)_15rem] min-[1180px]:min-h-[440px]">
          <div className="flex min-w-0 flex-col p-5 min-[1180px]:p-7">
            <div className="mb-4 flex items-start justify-between gap-4 min-[1180px]:mb-6">
              <div>
                <p className="text-xs font-medium text-muted">{completed + 1} / {totalInSession} · {STATE_LABELS[current.state]}</p>
                <h2 className="doodle-heading marker-highlight mt-2 text-2xl font-extrabold text-card-foreground">{current.name}</h2>
              </div>
              <SegmentedControl
                value={mode}
                ariaLabel="回忆方式"
                onValueChange={(value) => {
                  setMode(value as AnswerMode);
                  setRecall('');
                  setOralDone(false);
                  setRevealed(false);
                }}
                items={[
                  { value: 'typed', label: '输入回忆', icon: <Keyboard /> },
                  { value: 'oral', label: '口头回答', icon: <Mic /> },
                ]}
              />
            </div>

            {!revealed ? (
              <div className="flex flex-1 flex-col">
                <p className="mb-3 text-sm font-semibold text-muted">主动回忆</p>
                {mode === 'typed' ? (
                  <textarea
                    aria-label="主动回忆"
                    value={recall}
                    onChange={(event) => setRecall(event.target.value)}
                    placeholder="用自己的话回答，不要求逐字一致"
                    className="paper-subtle min-h-28 w-full resize-none rounded-[2px] border-2 border-dashed border-border bg-background p-4 text-sm leading-6 outline-none transition-[transform,border-color,box-shadow] focus:-translate-x-px focus:-translate-y-px focus:border-accent focus:shadow-[4px_4px_0_rgba(78,205,196,0.36)] min-[1180px]:min-h-40"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={oralDone}
                    onClick={() => setOralDone((value) => !value)}
                    className="doodle-row flex min-h-28 flex-col items-center justify-center rounded-[2px] border-2 border-dashed border-border bg-surface text-sm hover:border-primary hover:bg-highlight/10 min-[1180px]:min-h-40"
                  >
                    <Mic className="mb-3 size-6 text-muted" />
                    <span className="font-semibold">{oralDone ? '已完成口头回答' : '标记口头作答完成'}</span>
                    {oralDone ? <span className="mt-1 text-xs text-accent">可以查看答案</span> : null}
                  </button>
                )}
                <div className="mt-auto flex justify-end pt-3 min-[1180px]:pt-5">
                  <Button size="lg" disabled={!readyToReveal} onClick={() => setRevealed(true)}>
                    查看答案
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                {mode === 'typed' ? (
                  <div className="mb-4 rotate-[-0.1deg] border-l-2 border-dashed border-accent bg-accent/8 px-4 py-3 shadow-[3px_3px_0_rgba(78,205,196,0.2)]">
                    <p className="mb-1 text-xs font-medium text-muted">你的回忆</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{recall}</p>
                  </div>
                ) : null}
                <div className="mb-6">
                  <p className="mb-2 text-xs font-medium text-muted">概念定义</p>
                  <p className="whitespace-pre-wrap text-base leading-7 text-card-foreground">{current.definition}</p>
                </div>
                <div className="mt-auto grid grid-cols-4 gap-2">
                  {GRADE_OPTIONS.map((option) => (
                    <button
                      key={option.grade}
                      type="button"
                      disabled={busy}
                      onClick={() => grade(option.grade)}
                      className={`doodle-row min-h-20 rounded-[2px] border-2 border-dashed bg-card px-3 py-2 text-left transition-[transform,box-shadow,background-color,border-color] hover:-translate-x-px hover:-translate-y-px disabled:opacity-45 ${option.className}`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.description}</span>
                      <span className="mt-1.5 block text-xs font-medium">{current.preview[option.grade].intervalLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="border-t border-dashed border-border bg-card-soft/70 p-5 min-[960px]:border-l min-[960px]:border-t-0">
            <h3 className="text-xs font-semibold uppercase text-muted">记忆依据</h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div><dt className="text-xs text-muted">记忆状态</dt><dd className="mt-1 font-medium">{STATE_LABELS[current.state]}</dd></div>
              <div><dt className="text-xs text-muted">稳定性</dt><dd className="mt-1 font-medium">{current.stability.toFixed(1)} 天</dd></div>
              <div><dt className="text-xs text-muted">难度</dt><dd className="mt-1 font-medium">{current.difficulty.toFixed(1)} / 10</dd></div>
            </dl>
            <div className="my-5 border-t border-dashed border-border" />
            <Link href={current.sourceHref} className="doodle-link flex items-start gap-2 text-sm text-foreground">
              <Link2 className="mt-0.5 size-4 shrink-0" />
              <span>{current.sourceLabel}</span>
            </Link>
            <Button variant="outline" size="sm" className="mt-5 w-full" onClick={toggleDifficult} loading={busy}>
              <Flag className={`size-4 ${current.isDifficult ? 'fill-current text-pink' : ''}`} />
              {current.isDifficult ? '取消困难标记' : '标为困难卡'}
            </Button>
          </aside>
        </section>
      )}
    </PageShell>
  );
}

function isOverdue(dueAt: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(dueAt).getTime() < startOfToday.getTime();
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <div className={`flex items-center gap-2 ${tone === 'warning' ? 'text-yellow-foreground' : ''}`}>
      <span className="text-muted [&>svg]:size-4">{icon}</span>
      <span><span className="block text-[11px] text-muted">{label}</span><strong className="font-medium">{value}</strong></span>
    </div>
  );
}
