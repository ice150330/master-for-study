'use client';

import { useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';

type ReviewItem = {
  termId: string;
  name: string;
  definition: string;
  state: string;
  stability: number | null;
  difficulty: number | null;
};

type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_OPTIONS: Array<{ grade: Grade; label: string; className: string }> = [
  { grade: 'again', label: '忘记', className: 'bg-pink text-pink-foreground' },
  { grade: 'hard', label: '困难', className: 'bg-yellow text-yellow-foreground' },
  { grade: 'good', label: '一般', className: 'bg-accent text-accent-foreground' },
  { grade: 'easy', label: '轻松', className: 'bg-primary text-primary-foreground' },
];

export function ReviewView({ initialReviews }: { initialReviews: ReviewItem[] }) {
  const toast = useToast();
  const [queue, setQueue] = useState<ReviewItem[]>(initialReviews);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void; label: string } | null>(null);

  const current = queue[0];

  async function grade(g: Grade, previousIdempotencyKey?: string) {
    if (!current || busy) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('review');
    setBusy(true);
    setError(null);
    let submitted = false;
    try {
      await requestJson<{ next: unknown }>('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: current.termId, grade: g, idempotencyKey }),
      });
      submitted = true;
      const data = await requestJson<{ reviews: ReviewItem[] }>('/api/review');
      setQueue(data.reviews);
      setRevealed(false);
      toast({ title: '复习结果已记录', tone: 'success' });
    } catch (error) {
      setError({
        message: getErrorMessage(error, '复习结果提交失败'),
        retry: submitted ? refreshQueue : () => grade(g, idempotencyKey),
        label: submitted ? '刷新队列' : '重新提交',
      });
    } finally {
      setBusy(false);
    }
  }

  async function refreshQueue() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{ reviews: ReviewItem[] }>('/api/review');
      setQueue(data.reviews);
      setRevealed(false);
    } catch (error) {
      setError({
        message: getErrorMessage(error, '复习队列刷新失败'),
        retry: refreshQueue,
        label: '再次刷新',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="隐性巩固" description="在你遗忘前，悄悄考你" width="sm">

      {queue.length === 0 ? (
        <div className="rounded-2xl bg-card p-12 text-center">
          <p className="text-sm text-card-foreground/70">今日没有待复习的术语 🎉</p>
          <p className="mt-2 text-xs text-muted">去聊点新内容，术语会自动进入复习队列</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card p-8 shadow-md">
          {error ? (
            <InlineNotice
              className="mb-5"
              tone="error"
              title="复习进度未更新"
              description={`${error.message}。当前卡片和答案仍保留。`}
              actionLabel={error.label}
              onAction={error.retry}
            />
          ) : null}
          <div className="mb-4 text-xs font-medium text-muted">
            今日待复习 {queue.length} 张
          </div>

          <h2 className="mb-6 text-center text-2xl font-semibold text-card-foreground">
            {current.name}
          </h2>

          {!revealed ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground"
              >
                显示答案
              </button>
            </div>
          ) : (
            <>
              <p className="mb-8 whitespace-pre-wrap rounded-xl bg-card-soft p-4 text-sm leading-relaxed text-card-foreground/85">
                {current.definition}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {GRADE_OPTIONS.map((o) => (
                  <button
                    key={o.grade}
                    type="button"
                    onClick={() => grade(o.grade)}
                    disabled={busy}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${o.className}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
