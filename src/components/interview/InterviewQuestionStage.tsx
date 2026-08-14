import { ArrowLeft, Check, Clock3, MessageSquareMore, Send, Target } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import {
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_ROLES,
  INTERVIEW_STYLES,
  INTERVIEW_TOPICS,
  interviewOptionLabel,
} from '@/lib/interview/types';
import type { InterviewQuestionDto, InterviewSessionDetailDto } from './types';

export function InterviewQuestionStage({
  detail,
  question,
  answer,
  onAnswerChange,
  elapsedSeconds,
  busy,
  followUpBusy,
  retrying,
  onFollowUp,
  onSubmit,
  onExit,
}: {
  detail: InterviewSessionDetailDto;
  question: InterviewQuestionDto;
  answer: string;
  onAnswerChange(value: string): void;
  elapsedSeconds: number;
  busy: boolean;
  followUpBusy: boolean;
  retrying: boolean;
  onFollowUp(): void;
  onSubmit(): void;
  onExit(): void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="grid min-h-[650px] min-[1100px]:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="flex min-w-0 flex-col p-7" aria-labelledby="current-interview-question">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onExit} aria-label="返回面试设置">
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
              <div>
                <p className="text-xs font-semibold text-primary">
                  {retrying ? `第 ${question.roundIndex} 题 · 再次作答` : `第 ${question.roundIndex} 题`}
                </p>
                <p className="mt-0.5 text-xs text-muted">{question.skill}</p>
              </div>
            </div>
            <div className="flex h-9 min-w-24 items-center justify-center gap-2 rounded-md bg-surface px-3 font-mono text-sm tabular-nums text-card-foreground" aria-label="本题计时">
              <Clock3 aria-hidden="true" className="size-4 text-muted" />
              {formatDuration(elapsedSeconds)}
            </div>
          </div>

          <div className="flex-1 py-7">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Target aria-hidden="true" className="size-4" />
              <span>{interviewOptionLabel(INTERVIEW_DIFFICULTIES, question.difficulty)}难度</span>
            </div>
            <h2 id="current-interview-question" className="mt-4 max-w-4xl text-xl font-semibold leading-8 text-card-foreground">
              {question.question}
            </h2>
            {question.followUp ? (
              <div className="mt-5 border-l-2 border-primary pl-4" role="status">
                <p className="text-xs font-semibold text-primary">面试官追问</p>
                <p className="mt-1 text-sm leading-6 text-card-foreground">{question.followUp}</p>
              </div>
            ) : null}

            <label htmlFor="interview-answer" className="mt-7 block text-xs font-semibold text-card-foreground">
              你的回答
            </label>
            <Textarea
              id="interview-answer"
              aria-label="面试回答"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={busy}
              placeholder="先给出结论，再说明依据、权衡与边界…"
              className="mt-2 min-h-64 resize-none bg-card-soft text-sm leading-6"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{answer.trim().length} 字</span>
              <span>评分会在提交后显示</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="outline"
              loading={followUpBusy}
              disabled={Boolean(question.followUp) || answer.trim().length < 12 || busy}
              onClick={onFollowUp}
            >
              <MessageSquareMore aria-hidden="true" className="size-4" />
              {question.followUp ? '已获得追问' : '请求追问'}
            </Button>
            <Button size="lg" loading={busy} disabled={answer.trim().length < 20 || followUpBusy} onClick={onSubmit}>
              <Send aria-hidden="true" className="size-4" />
              提交本题
            </Button>
          </div>
        </section>

        <aside className="border-l border-border bg-surface/65 p-5" aria-label="面试进度">
          <p className="text-xs font-semibold text-foreground">本场进度</p>
          <div className="mt-3 grid grid-cols-5 gap-1" aria-label={`${detail.session.currentRound}/${detail.session.totalRounds} 题`}>
            {Array.from({ length: detail.session.totalRounds }, (_, index) => {
              const round = index + 1;
              const completed = detail.questions.some((item) => item.roundIndex === round && item.attempts.length > 0);
              const current = round === question.roundIndex;
              return (
                <span
                  key={round}
                  className={`h-1.5 rounded-sm ${completed ? 'bg-accent' : current ? 'bg-primary' : 'bg-border'}`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">第 {question.roundIndex} / {detail.session.totalRounds} 题</p>

          <dl className="mt-6 grid gap-4 border-y border-border py-5 text-xs">
            <Meta label="岗位" value={interviewOptionLabel(INTERVIEW_ROLES, detail.session.role)} />
            <Meta label="主题" value={interviewOptionLabel(INTERVIEW_TOPICS, detail.session.topic)} />
            <Meta label="当前难度" value={interviewOptionLabel(INTERVIEW_DIFFICULTIES, question.difficulty)} />
            <Meta label="面试官" value={interviewOptionLabel(INTERVIEW_STYLES, detail.session.teacherStyle)} />
          </dl>

          {detail.questions.length > 1 || question.attempts.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold text-foreground">已完成记录</p>
              <div className="mt-3 grid gap-2">
                {detail.questions.filter((item) => item.attempts.length > 0).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-muted">
                    <span className="flex size-5 items-center justify-center rounded-full bg-accent/12 text-accent">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                    <span>第 {item.roundIndex} 题 · {item.attempts.length} 次作答</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
