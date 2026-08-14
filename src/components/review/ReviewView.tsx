'use client';

import { useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';

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
  const [queue, setQueue] = useState<ReviewItem[]>(initialReviews);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = queue[0];

  async function grade(g: Grade) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: current.termId, grade: g }),
      });
      const res = await fetch('/api/review');
      if (res.ok) setQueue(((await res.json()) as { reviews: ReviewItem[] }).reviews);
      setRevealed(false);
    } catch (err) {
      console.error(err);
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
