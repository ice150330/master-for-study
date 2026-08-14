'use client';

import { useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';

type Interview = {
  id: string;
  question: string;
  answer: string | null;
  feedback: string | null;
  correct: boolean | null;
  createdAt: string;
};

export function InterviewView({ initialInterviews }: { initialInterviews: Interview[] }) {
  const [history, setHistory] = useState<Interview[]>(initialInterviews);
  const [current, setCurrent] = useState<Interview | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    const res = await fetch('/api/interview');
    if (res.ok) setHistory(((await res.json()) as { interviews: Interview[] }).interviews);
  }

  async function askQuestion() {
    setBusy(true);
    setAnswer('');
    setFeedback(null);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'question' }),
      });
      if (!res.ok) throw new Error('出题失败');
      const data = (await res.json()) as { interview: Interview };
      setCurrent(data.interview);
      await loadHistory();
    } catch (err) {
      console.error(err);
      alert('出题失败，请确认 DeepSeek key 有效');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!current || !answer.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', id: current.id, answer: answer.trim() }),
      });
      if (!res.ok) throw new Error('判分失败');
      const data = (await res.json()) as { correct: boolean; feedback: string };
      setFeedback(data);
      await loadHistory();
    } catch (err) {
      console.error(err);
      alert('判分失败，请确认 DeepSeek key 有效');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="模拟面试" description="依据画像出题，答后分层判分">

      <div className="rounded-2xl bg-card p-6 shadow-md">
        {!current ? (
          <div className="py-10 text-center">
            <button
              type="button"
              onClick={askQuestion}
              disabled={busy}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? '出题中…' : '开始面试'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-card-foreground">{current.question}</p>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              disabled={busy || !!feedback}
              placeholder="写下你的回答…"
              className="mt-4 w-full resize-none rounded-xl border border-border bg-card-soft px-4 py-3 text-sm text-card-foreground outline-none focus:border-primary"
            />

            {!feedback ? (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!answer.trim() || busy}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? '判分中…' : '提交答案'}
                </button>
              </div>
            ) : (
              <div
                className={`mt-4 rounded-xl p-4 text-sm leading-relaxed ${
                  feedback.correct ? 'bg-accent/20 text-card-foreground' : 'bg-pink/20 text-card-foreground'
                }`}
              >
                <div className="mb-1 font-semibold">
                  {feedback.correct ? '✓ 回答正确' : '✗ 还需加强'}
                </div>
                <p className="whitespace-pre-wrap">{feedback.feedback}</p>
                <button
                  type="button"
                  onClick={askQuestion}
                  disabled={busy}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  下一题
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">面试记录</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl bg-surface p-3 text-sm">
                <p className="text-foreground">{h.question}</p>
                {h.feedback && (
                  <p className="mt-1 text-xs text-muted">
                    {h.correct ? '✓' : '✗'} {h.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
