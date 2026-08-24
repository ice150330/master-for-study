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
import { reviewCompletionCopy } from '@/lib/ai/teacher-style';

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
  /** A2 队列治理：待确认入队的新概念（空态批量确认用） */
  pending?: Array<{ termId: string; name: string; definition: string }>;
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
  const [pending, setPending] = useState(initialQueue.pending ?? []);
  const [completed, setCompleted] = useState(0);
  const [mode, setMode] = useState<AnswerMode>('typed');
  const [recall, setRecall] = useState('');
  const [oralDone, setOralDone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastReview, setLastReview] = useState<LastReview | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void; label: string } | null>(null);
  // 场景绑定（B6）：完成语按「复习场景覆盖 ?? 全局风格」措辞
  const [sceneStyle, setSceneStyle] = useState('lecturer');
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const raw = (await res.json()) as { settings?: { teacherStyle?: unknown; reviewStyle?: unknown } };
        const style = raw.settings?.reviewStyle ?? raw.settings?.teacherStyle;
        if (!cancelled && typeof style === 'string' && style) setSceneStyle(style);
      } catch {
        // 维持默认文案
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /** A2 队列治理：跳过本次（+1 天）/ 降低频率（+30 天），不产生复习记录。 */
  async function deferCurrent(days: 1 | 30) {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'defer',
          termId: current.termId,
          days,
          idempotencyKey: createIdempotencyKey('review-defer'),
        }),
      });
      consumeCurrent();
      toast({ title: days === 1 ? '已跳过，明天再见' : '已降低频率，30 天后回来', tone: 'success' });
    } catch (error) {
      setError({ message: getErrorMessage(error, '队列操作失败'), retry: () => deferCurrent(days), label: '重试' });
    } finally {
      setBusy(false);
    }
  }

  /** A2 队列治理：把这个概念移出复习队列（可从概念轨道恢复）。 */
  async function dismissCurrent() {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue',
          termId: current.termId,
          queueStatus: 'dismissed',
          idempotencyKey: createIdempotencyKey('review-dismiss'),
        }),
      });
      consumeCurrent();
      toast({ title: '已移出复习队列', description: '可在概念详情中恢复', tone: 'success' });
    } catch (error) {
      setError({ message: getErrorMessage(error, '移出失败'), retry: dismissCurrent, label: '重试' });
    } finally {
      setBusy(false);
    }
  }

  /** 从当前队列消耗一张卡（跳过/移出共用：不计数为完成，只收缩今日余量）。 */
  function consumeCurrent() {
    if (!current) return;
    setQueue((items) => items.slice(1));
    setSummary((value) => {
      const due = Math.max(0, value.due - 1);
      return {
        ...value,
        due,
        overdue: isOverdue(current.dueAt) ? Math.max(0, value.overdue - 1) : value.overdue,
        estimatedMinutes: due === 0 ? 0 : Math.max(1, Math.ceil(due * 0.75)),
      };
    });
    resetCard();
  }

  /** A2：确认一个待定概念入队。 */
  async function confirmPending(termId: string) {
    try {
      await requestJson('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue',
          termId,
          queueStatus: 'active',
          idempotencyKey: createIdempotencyKey('review-queue'),
        }),
      });
      setPending((items) => items.filter((item) => item.termId !== termId));
    } catch (error) {
      toast({ title: '确认入队失败', description: getErrorMessage(error, '请稍后重试'), tone: 'error' });
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

      {summary.overdue > 0 ? (
        <p className="mb-3 rotate-[-0.1deg] border-l-2 border-dashed border-yellow/70 bg-yellow/8 px-3 py-1.5 text-xs text-yellow-foreground">
          有 {summary.overdue} 张逾期卡——队列已按到期时间排序，建议先清最旧的几张，不必一次清完。
        </p>
      ) : null}

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
          <h2 className="doodle-heading text-lg font-extrabold">{reviewCompletionCopy(sceneStyle).title}</h2>
          <p className="mt-2 max-w-md text-sm text-muted">{reviewCompletionCopy(sceneStyle).note}</p>
          {pending.length > 0 ? (
            <div className="mt-6 w-full max-w-lg text-left">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  {pending.length} 个新概念待确认 · 确认后进入复习队列
                </p>
                <button
                  type="button"
                  onClick={() => {
                    for (const item of pending) void confirmPending(item.termId);
                  }}
                  className="doodle-link text-xs font-semibold text-foreground"
                >
                  全部确认
                </button>
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {pending.map((item) => (
                  <li
                    key={item.termId}
                    className="doodle-row flex items-center justify-between gap-3 rounded-[2px] border border-dashed px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{item.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">{item.definition}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void confirmPending(item.termId)}
                      className="doodle-action shrink-0 rounded-[2px] border-2 border-dashed border-foreground bg-card px-2 py-1 text-[11px] font-semibold text-foreground"
                    >
                      确认入队
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
            <div className="mt-2 grid grid-cols-2 gap-1">
              <Button variant="ghost" size="sm" onClick={() => void deferCurrent(1)} disabled={busy}>
                跳过本次
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void deferCurrent(30)} disabled={busy}>
                降低频率
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-1 w-full text-muted" onClick={() => void dismissCurrent()} disabled={busy}>
              移出复习队列
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
