'use client';

import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import type { InterviewSettings } from '@/lib/interview/types';
import { InterviewFeedback } from './InterviewFeedback';
import { InterviewQuestionStage } from './InterviewQuestionStage';
import { InterviewSetup } from './InterviewSetup';
import { InterviewSummary } from './InterviewSummary';
import type {
  InterviewAttemptDto,
  InterviewQuestionDto,
  InterviewSessionDetailDto,
  InterviewSessionDto,
} from './types';

type ViewMode = 'setup' | 'question' | 'feedback' | 'summary';
type InterviewAction = 'start' | 'next' | 'followup' | 'answer';

const defaultSettings: InterviewSettings = {
  role: 'backend',
  topic: 'system-design',
  difficulty: 'standard',
  totalRounds: 3,
  teacherStyle: 'guided',
};

export function InterviewView({ initialSessions }: { initialSessions: InterviewSessionDetailDto[] }) {
  const toast = useToast();
  const startedAtRef = useRef(0);
  const [history, setHistory] = useState(initialSessions);
  const [settings, setSettings] = useState<InterviewSettings>(defaultSettings);
  const [detail, setDetail] = useState<InterviewSessionDetailDto | null>(null);
  const [mode, setMode] = useState<ViewMode>('setup');
  const [answer, setAnswer] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [busyAction, setBusyAction] = useState<InterviewAction | null>(null);
  const [error, setError] = useState<{
    action: InterviewAction;
    message: string;
    idempotencyKey: string;
  } | null>(null);

  const current = detail?.questions.at(-1) ?? null;
  const currentAttempt = current?.attempts.at(-1) ?? null;
  const previousAttempt = current && current.attempts.length > 1
    ? current.attempts.at(-2) ?? null
    : null;

  useEffect(() => {
    if (mode !== 'question') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [mode, current?.id]);

  async function start(previousIdempotencyKey?: string) {
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('interview-start');
    setBusyAction('start');
    setError(null);
    try {
      const data = await requestJson<{ detail: InterviewSessionDetailDto }>('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', ...settings, idempotencyKey }),
      });
      enterQuestion(data.detail);
      updateHistory(data.detail);
    } catch (requestError) {
      setError({ action: 'start', message: getErrorMessage(requestError, '暂时无法开始面试'), idempotencyKey });
    } finally {
      setBusyAction(null);
    }
  }

  async function requestFollowUp(previousIdempotencyKey?: string) {
    if (!current) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('interview-followup');
    setBusyAction('followup');
    setError(null);
    try {
      const data = await requestJson<{ interview: InterviewQuestionDto }>('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'followup', id: current.id, answerDraft: answer.trim(), idempotencyKey }),
      });
      setDetail((value) => value ? replaceCurrentQuestion(value, data.interview) : value);
      toast({ title: '面试官已补充追问', tone: 'info' });
    } catch (requestError) {
      setError({ action: 'followup', message: getErrorMessage(requestError, '追问生成失败'), idempotencyKey });
    } finally {
      setBusyAction(null);
    }
  }

  async function submit(previousIdempotencyKey?: string) {
    if (!current || !answer.trim()) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('interview-answer');
    setBusyAction('answer');
    setError(null);
    try {
      const data = await requestJson<{
        session: InterviewSessionDto;
        interview: InterviewQuestionDto;
        attempt: InterviewAttemptDto;
        attempts: InterviewAttemptDto[];
      }>('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          id: current.id,
          answer: answer.trim(),
          durationMs: elapsedSeconds * 1_000,
          idempotencyKey,
        }),
      });
      const updatedQuestion = { ...data.interview, attempts: data.attempts };
      const nextDetail = {
        session: data.session,
        questions: (detail?.questions ?? []).map((question) => question.id === current.id ? updatedQuestion : question),
      };
      setDetail(nextDetail);
      updateHistory(nextDetail);
      setMode('feedback');
      toast({ title: data.attempt.version > 1 ? '新版本已完成评估' : '回答已完成评估', tone: 'success' });
    } catch (requestError) {
      setError({ action: 'answer', message: getErrorMessage(requestError, '回答尚未完成评估'), idempotencyKey });
    } finally {
      setBusyAction(null);
    }
  }

  async function next(previousIdempotencyKey?: string) {
    if (!detail) return;
    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('interview-next');
    setBusyAction('next');
    setError(null);
    try {
      const data = await requestJson<{ detail: InterviewSessionDetailDto }>('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next', interviewSessionId: detail.session.id, idempotencyKey }),
      });
      enterQuestion(data.detail);
      updateHistory(data.detail);
    } catch (requestError) {
      setError({ action: 'next', message: getErrorMessage(requestError, '下一题生成失败'), idempotencyKey });
    } finally {
      setBusyAction(null);
    }
  }

  function retryCurrent() {
    setAnswer('');
    resetTimer();
    setError(null);
    setMode('question');
  }

  function enterQuestion(nextDetail: InterviewSessionDetailDto) {
    setDetail(nextDetail);
    setAnswer('');
    resetTimer();
    setMode('question');
  }

  function resume(nextDetail: InterviewSessionDetailDto) {
    setDetail(nextDetail);
    setAnswer('');
    setError(null);
    const latest = nextDetail.questions.at(-1);
    if (nextDetail.session.status === 'completed') setMode('summary');
    else if (latest?.attempts.length) setMode('feedback');
    else {
      resetTimer();
      setMode('question');
    }
  }

  function restart() {
    if (detail) updateHistory(detail);
    setDetail(null);
    setAnswer('');
    setError(null);
    setMode('setup');
  }

  function resetTimer() {
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
  }

  function updateHistory(nextDetail: InterviewSessionDetailDto) {
    setHistory((items) => [nextDetail, ...items.filter((item) => item.session.id !== nextDetail.session.id)]);
  }

  function retryFailedAction() {
    if (!error) return;
    if (error.action === 'start') void start(error.idempotencyKey);
    if (error.action === 'followup') void requestFollowUp(error.idempotencyKey);
    if (error.action === 'answer') void submit(error.idempotencyKey);
    if (error.action === 'next') void next(error.idempotencyKey);
  }

  return (
    <PageShell
      title="模拟面试"
      description="按真实 rubric 评估，并依据每轮表现调整下一题"
      width="xl"
      actions={mode !== 'setup' ? (
        <Button variant="outline" size="sm" onClick={restart}>
          <Plus aria-hidden="true" className="size-4" />
          新面试
        </Button>
      ) : undefined}
    >
      {error ? (
        <InlineNotice
          className="mb-4"
          tone="error"
          title={errorTitle(error.action)}
          description={`${error.message}。${error.action === 'answer' ? '你的回答仍保留在编辑器中。' : '当前场次状态没有改变。'}`}
          actionLabel="重试"
          onAction={retryFailedAction}
        />
      ) : null}

      {mode === 'setup' ? (
        <InterviewSetup
          settings={settings}
          onSettingsChange={setSettings}
          onStart={() => void start()}
          busy={busyAction === 'start'}
          history={history}
          onResume={resume}
        />
      ) : null}
      {mode === 'question' && detail && current ? (
        <InterviewQuestionStage
          detail={detail}
          question={current}
          answer={answer}
          onAnswerChange={setAnswer}
          elapsedSeconds={elapsedSeconds}
          busy={busyAction === 'answer'}
          followUpBusy={busyAction === 'followup'}
          retrying={current.attempts.length > 0}
          onFollowUp={() => void requestFollowUp()}
          onSubmit={() => void submit()}
          onExit={restart}
        />
      ) : null}
      {mode === 'feedback' && detail && current && currentAttempt ? (
        <InterviewFeedback
          detail={detail}
          question={current}
          attempt={currentAttempt}
          previousAttempt={previousAttempt}
          busy={busyAction === 'next'}
          onRetry={retryCurrent}
          onNext={() => void next()}
          onComplete={() => setMode('summary')}
          onExit={restart}
        />
      ) : null}
      {mode === 'summary' && detail ? <InterviewSummary detail={detail} onRestart={restart} /> : null}
    </PageShell>
  );
}

function replaceCurrentQuestion(detail: InterviewSessionDetailDto, interview: InterviewQuestionDto) {
  return {
    ...detail,
    questions: detail.questions.map((question) => question.id === interview.id
      ? { ...interview, attempts: question.attempts }
      : question),
  };
}

function errorTitle(action: InterviewAction) {
  if (action === 'start') return '暂时无法开始面试';
  if (action === 'next') return '下一题尚未生成';
  if (action === 'followup') return '追问尚未生成';
  return '回答尚未完成评估';
}
