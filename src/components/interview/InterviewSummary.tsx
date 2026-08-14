import { ArrowRight, CheckCircle2, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { interviewOverallScore } from '@/lib/interview/types';
import type { InterviewAttemptDto, InterviewSessionDetailDto } from './types';

export function InterviewSummary({
  detail,
  onRestart,
}: {
  detail: InterviewSessionDetailDto;
  onRestart(): void;
}) {
  const attempts = detail.questions
    .map((question) => question.attempts.at(-1))
    .filter((attempt): attempt is InterviewAttemptDto => Boolean(attempt));
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + interviewOverallScore(attempt.scores), 0) / attempts.length)
    : 0;
  const advances = attempts.filter((attempt) => attempt.nextStrategy === 'advance').length;
  const gaps = detail.questions.filter((question) => question.attempts.at(-1)?.nextStrategy === 'downgrade');
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="grid min-h-[620px] min-[1080px]:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-r border-border bg-surface/65 p-6">
          <CheckCircle2 aria-hidden="true" className="size-6 text-accent" />
          <p className="mt-4 text-xs font-semibold text-accent">本场已完成</p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-card-foreground">{average}</p>
          <p className="mt-1 text-xs text-muted">平均得分 / 100</p>
          <dl className="mt-7 grid gap-4 border-y border-border py-5 text-xs">
            <Meta label="完成题目" value={`${attempts.length} / ${detail.session.totalRounds}`} />
            <Meta label="难度提升" value={`${advances} 次`} />
            <Meta label="前置缺口" value={`${gaps.length} 项`} />
          </dl>
          <Button className="mt-6 w-full" variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden="true" className="size-4" />
            开始新面试
          </Button>
        </aside>

        <section className="p-7" aria-labelledby="interview-summary-title">
          <h2 id="interview-summary-title" className="text-xl font-semibold text-card-foreground">本场表现轨迹</h2>
          <p className="mt-2 text-sm text-muted">每道题保留最后一次作答结果，重答版本仍可从历史场次中查看。</p>
          <div className="mt-7 border-y border-border">
            {detail.questions.map((question) => {
              const attempt = question.attempts.at(-1);
              if (!attempt) return null;
              return (
                <div key={question.id} className="grid gap-3 border-b border-border py-5 last:border-b-0 min-[900px]:grid-cols-[4rem_minmax(0,1fr)_8rem]">
                  <div>
                    <p className="text-xs text-muted">第 {question.roundIndex} 题</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-card-foreground">{interviewOverallScore(attempt.scores)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-card-foreground">{question.skill}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{attempt.summary}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-xs font-medium">
                    {attempt.nextStrategy === 'advance' ? <TrendingUp aria-hidden="true" className="size-4 text-accent" /> : attempt.nextStrategy === 'downgrade' ? <TrendingDown aria-hidden="true" className="size-4 text-danger" /> : null}
                    <span>{strategyLabel(attempt.nextStrategy)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {gaps.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-sm font-semibold text-card-foreground">建议先补齐</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {gaps.map((question) => (
                  question.termId ? (
                    <Link key={question.id} href={`/?concept=${question.termId}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-primary hover:bg-surface">
                      {question.attempts.at(-1)?.prerequisite ?? question.skill}
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  ) : null
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="font-medium text-card-foreground">{value}</dd></div>;
}

function strategyLabel(strategy: 'advance' | 'stay' | 'downgrade') {
  return strategy === 'advance' ? '提升' : strategy === 'downgrade' ? '回退' : '保持';
}
