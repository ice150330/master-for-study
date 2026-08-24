import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, Minus, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { interviewOverallScore } from '@/lib/interview/types';
import type { InterviewAttemptDto, InterviewQuestionDto, InterviewSessionDetailDto } from './types';

const dimensions = [
  { key: 'correctness', label: '正确性' },
  { key: 'structure', label: '结构' },
  { key: 'evidence', label: '证据' },
  { key: 'communication', label: '表达' },
] as const;

export function InterviewFeedback({
  detail,
  question,
  attempt,
  previousAttempt,
  busy,
  onRetry,
  onNext,
  onComplete,
  onExit,
}: {
  detail: InterviewSessionDetailDto;
  question: InterviewQuestionDto;
  attempt: InterviewAttemptDto;
  previousAttempt: InterviewAttemptDto | null;
  busy: boolean;
  onRetry(): void;
  onNext(): void;
  onComplete(): void;
  onExit(): void;
}) {
  const score = interviewOverallScore(attempt.scores);
  const completed = detail.session.status === 'completed';
  return (
    <div
      data-context-focus={`interview:${attempt.id}`}
      tabIndex={-1}
      className="paper-panel overflow-hidden rounded-[2px] border-2 border-dashed outline-none"
    >
      <div className="grid min-h-[650px] min-[1100px]:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 p-7" aria-labelledby="interview-feedback-title">
          <div className="flex items-start justify-between gap-5 border-b border-dashed border-border pb-5">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="sm" onClick={onExit} aria-label="返回面试设置">
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
              <div>
                <p className="text-xs font-semibold text-primary">第 {question.roundIndex} 题 · 第 {attempt.version} 次作答</p>
                <h2 id="interview-feedback-title" className="doodle-heading mt-1 text-lg font-extrabold text-card-foreground">本题反馈</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="marker-highlight text-3xl font-extrabold tabular-nums text-card-foreground">{score}</p>
              <p className="mt-0.5 text-[11px] text-muted">综合得分 / 100</p>
            </div>
          </div>

          <div className={`mt-5 flex rotate-[-0.15deg] items-start gap-3 rounded-[2px] border-2 border-dashed px-4 py-3 shadow-[3px_3px_0_rgba(255,217,61,0.24)] ${strategyStyle(attempt.nextStrategy)}`} role="status">
            <span className="mt-0.5">{strategyIcon(attempt.nextStrategy)}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{strategyTitle(attempt.nextStrategy)}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{attempt.summary}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-0 border-y border-dashed border-border" role="group" aria-label="评分维度">
            {dimensions.map((dimension) => {
              const current = attempt.scores[dimension.key];
              const previous = previousAttempt?.scores[dimension.key];
              const delta = previous ? current.score - previous.score : null;
              return (
                <div key={dimension.key} className="grid items-center gap-3 border-b border-dashed border-border px-1 py-4 last:border-b-0 min-[900px]:grid-cols-[6rem_9rem_minmax(0,1fr)_3rem]">
                  <p className="text-sm font-semibold text-card-foreground">{dimension.label}</p>
                  <div className="flex gap-1" role="img" aria-label={`${dimension.label} ${current.score} 分`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} className={`h-1.5 w-6 rounded-sm ${index < current.score ? 'bg-primary' : 'bg-border'}`} />
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-muted">{current.note}</p>
                  <div className="text-right text-sm font-extrabold tabular-nums text-card-foreground">
                    {current.score}/5
                    {delta !== null ? <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-accent' : delta < 0 ? 'text-danger' : 'text-muted'}`}>{delta > 0 ? `+${delta}` : delta}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {previousAttempt ? (
            <div className="mt-5 flex rotate-[0.15deg] items-center justify-between rounded-[2px] border border-dashed border-accent/50 bg-accent/8 px-4 py-3 text-xs shadow-[3px_3px_0_rgba(78,205,196,0.2)]">
              <span className="text-muted">与第 {previousAttempt.version} 次作答比较</span>
              <strong className="text-card-foreground">
                {interviewOverallScore(previousAttempt.scores)} → {score}
              </strong>
            </div>
          ) : null}

          <div className="mt-7 grid gap-7 min-[980px]:grid-cols-2">
            <section>
              <h3 className="text-sm font-semibold text-card-foreground">回答原文证据</h3>
              <div className="mt-3 grid gap-3">
                {attempt.evidence.map((item, index) => (
                  <blockquote key={`${item.dimension}-${index}`} className="border-l-2 border-dashed border-primary bg-highlight/8 px-4 py-3">
                    <p className="text-xs leading-5 text-card-foreground">“{item.quote}”</p>
                    <footer className="mt-1 text-[11px] leading-5 text-muted">{dimensionLabel(item.dimension)} · {item.note}</footer>
                  </blockquote>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-card-foreground">下一次优先改进</h3>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted">
                {attempt.improvements.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rotate-45 bg-danger" />{item}</li>)}
              </ul>
              <details className="mt-5 border-t border-dashed border-border pt-4">
                <summary className="doodle-link cursor-pointer text-xs font-semibold text-foreground">展开参考回答</summary>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-card-foreground">{attempt.modelAnswer}</p>
              </details>
            </section>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-dashed border-border pt-5">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw aria-hidden="true" className="size-4" />
                同题再答
              </Button>
              {attempt.nextStrategy === 'downgrade' && question.termId ? (
                <Link href={`/?concept=${question.termId}`} className="doodle-link inline-flex h-9 items-center gap-2 rounded-[2px] px-3 text-xs font-semibold text-foreground hover:bg-highlight/15">
                  <BookOpenText aria-hidden="true" className="size-4" />
                  学习前置知识
                </Link>
              ) : null}
            </div>
            {completed ? (
              <Button size="lg" onClick={onComplete}>查看本场总结<ArrowRight aria-hidden="true" className="size-4" /></Button>
            ) : (
              <Button size="lg" loading={busy} onClick={onNext}>进入下一题<ArrowRight aria-hidden="true" className="size-4" /></Button>
            )}
          </div>
        </section>

        <aside className="paper-subtle border-l border-dashed border-border p-5" aria-label="本题概览">
          <p className="text-xs font-semibold text-foreground">考察能力</p>
          <p className="mt-2 text-sm font-semibold text-card-foreground">{question.skill}</p>
          <p className="mt-1 text-xs text-muted">第 {question.roundIndex} / {detail.session.totalRounds} 题</p>

          <div className="mt-6 border-y border-dashed border-border py-5">
            <p className="text-xs font-semibold text-foreground">回答版本</p>
            <div className="mt-3 grid gap-2">
              {question.attempts.map((item) => (
                <div key={item.id} className={`flex items-center justify-between rounded-[2px] border border-dashed px-3 py-2 text-xs ${item.id === attempt.id ? 'rotate-[-0.3deg] border-foreground bg-highlight/15 text-foreground shadow-[2px_2px_0_var(--marker-teal)]' : 'border-transparent text-muted'}`}>
                  <span>第 {item.version} 版</span>
                  <strong className="font-extrabold tabular-nums">{interviewOverallScore(item.scores)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold text-foreground">本次亮点</p>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted">
              {attempt.strengths.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent" />{item}</li>)}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function strategyStyle(strategy: InterviewAttemptDto['nextStrategy']) {
  return strategy === 'advance' ? 'border-accent/30 bg-accent/8' : strategy === 'downgrade' ? 'border-danger/30 bg-danger/8' : 'border-primary/25 bg-primary/8';
}

function strategyTitle(strategy: InterviewAttemptDto['nextStrategy']) {
  return strategy === 'advance' ? '已达到当前难度，下一题升级' : strategy === 'downgrade' ? '核心知识有缺口，下一题回到前置层' : '部分达标，下一题保持难度';
}

function strategyIcon(strategy: InterviewAttemptDto['nextStrategy']) {
  return strategy === 'advance' ? <TrendingUp aria-hidden="true" className="size-4 text-accent" /> : strategy === 'downgrade' ? <TrendingDown aria-hidden="true" className="size-4 text-danger" /> : <Minus aria-hidden="true" className="size-4 text-primary" />;
}

function dimensionLabel(dimension: string) {
  return dimensions.find((item) => item.key === dimension)?.label ?? dimension;
}
