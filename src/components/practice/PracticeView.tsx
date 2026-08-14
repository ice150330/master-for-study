'use client';

import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Eye,
  Lightbulb,
  Play,
  RotateCcw,
  Rows3,
  TableProperties,
  History,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { SQL_CHALLENGES, getSqlChallenge } from '@/lib/practice/challenges';
import type {
  ChallengeValidation,
  SqlChallenge,
  SqlExecutionResult,
  SqlResultSet,
  SqlValue,
} from '@/lib/practice/types';
import { validateChallenge } from '@/lib/practice/validator';
import {
  SqlExecutionTimeoutError,
  SqlWorkerClient,
  SqlWorkerExecutionError,
} from '@/lib/practice/worker-client';

type RunErrorType = 'syntax' | 'runtime' | 'timeout' | 'validation';

type AttemptPayload = {
  challengeId: string;
  conceptId: string | null;
  status: 'success' | 'error';
  errorType: RunErrorType | null;
  runCount: number;
  hintCount: number;
  durationMs: number;
  sql: string;
  result: Record<string, unknown>;
  skills: string[];
  idempotencyKey: string;
};

type FocusPracticeAttempt = {
  id: string;
  challengeId: string;
  status: 'success' | 'error';
  errorType: RunErrorType | null;
  runCount: number;
  hintCount: number;
  durationMs: number;
  createdAt: string;
};

export function PracticeView({
  initialChallengeId,
  conceptId = null,
  focusAttempt = null,
}: {
  initialChallengeId?: string | null;
  conceptId?: string | null;
  focusAttempt?: FocusPracticeAttempt | null;
}) {
  const toast = useToast();
  const runnerRef = useRef<SqlWorkerClient | null>(null);
  const initial = getSqlChallenge(initialChallengeId);
  const [challengeId, setChallengeId] = useState(initial.id);
  const [sql, setSql] = useState(initial.starterSql);
  const [execution, setExecution] = useState<SqlExecutionResult | null>(null);
  const [validation, setValidation] = useState<ChallengeValidation | null>(null);
  const [runError, setRunError] = useState<{ type: RunErrorType; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [persistenceError, setPersistenceError] = useState<{
    message: string;
    retry: () => void;
  } | null>(null);

  const challenge = useMemo(() => getSqlChallenge(challengeId), [challengeId]);
  const resultSet = lastVisibleResult(challenge, execution);
  const currentIndex = SQL_CHALLENGES.findIndex((item) => item.id === challenge.id);
  const nextChallenge = SQL_CHALLENGES[currentIndex + 1] ?? null;

  useEffect(() => () => runnerRef.current?.dispose(), []);

  function selectChallenge(next: SqlChallenge) {
    setChallengeId(next.id);
    setSql(next.starterSql);
    setExecution(null);
    setValidation(null);
    setRunError(null);
    setHintCount(0);
    setRunCount(0);
    setPersistenceError(null);
  }

  function reset() {
    setSql(challenge.starterSql);
    setExecution(null);
    setValidation(null);
    setRunError(null);
    setHintCount(0);
    setPersistenceError(null);
    runnerRef.current?.dispose();
    runnerRef.current = null;
  }

  async function run() {
    if (!sql.trim() || busy) return;
    const nextRunCount = runCount + 1;
    setRunCount(nextRunCount);
    setBusy(true);
    setExecution(null);
    setValidation(null);
    setRunError(null);
    setPersistenceError(null);
    try {
      const runner = runnerRef.current ?? new SqlWorkerClient();
      runnerRef.current = runner;
      const result = await runner.execute({
        seedSql: challenge.seedSql,
        sql,
        verificationSql: challenge.expectedResult.verificationSql,
        rowLimit: 100,
      });
      const check = validateChallenge(challenge, result);
      setExecution(result);
      setValidation(check);
      if (check.passed) {
        setCompleted((items) => new Set(items).add(challenge.id));
        toast({ title: 'SQL 任务通过', tone: 'success' });
      }
      const payload = attemptPayload({
        challenge,
        conceptId,
        sql,
        runCount: nextRunCount,
        hintCount,
        durationMs: result.durationMs,
        validation: check,
      });
      await persistAttempt(payload);
    } catch (error) {
      const type = classifySqlError(error);
      const message = error instanceof Error ? error.message : String(error);
      setRunError({ type, message });
      const payload: AttemptPayload = {
        challengeId: challenge.id,
        conceptId,
        status: 'error',
        errorType: type,
        runCount: nextRunCount,
        hintCount,
        durationMs: error instanceof SqlWorkerExecutionError || error instanceof SqlExecutionTimeoutError
          ? error.durationMs
          : 0,
        sql,
        result: { message },
        skills: challenge.skills,
        idempotencyKey: createIdempotencyKey('practice-attempt'),
      };
      await persistAttempt(payload);
    } finally {
      setBusy(false);
    }
  }

  async function persistAttempt(payload: AttemptPayload) {
    try {
      await requestJson('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setPersistenceError(null);
    } catch (error) {
      setPersistenceError({
        message: getErrorMessage(error, '运行结果未写入学习记录'),
        retry: () => { void persistAttempt(payload); },
      });
    }
  }

  return (
    <PageShell title="SQL 实践" description="以结果为准，允许不同但等价的解法" width="xl">
      {persistenceError ? (
        <InlineNotice
          className="mb-4"
          tone="error"
          title="SQL 已执行，但学习记录未保存"
          description={persistenceError.message}
          actionLabel="重新保存"
          onAction={persistenceError.retry}
        />
      ) : null}

      {focusAttempt ? (
        <section
          data-context-focus={`practice:${focusAttempt.id}`}
          tabIndex={-1}
          className="mb-4 flex items-center justify-between gap-4 rounded-md border border-primary/25 bg-primary/8 px-4 py-3 outline-none"
        >
          <div className="flex min-w-0 items-center gap-3">
            <History aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">正在查看一次历史尝试</p>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {focusAttempt.status === 'success' ? '任务通过' : `未通过${focusAttempt.errorType ? ` · ${focusAttempt.errorType}` : ''}`}
                {' · '}{focusAttempt.runCount} 次运行 · {focusAttempt.hintCount} 次提示 · {Math.max(1, Math.round(focusAttempt.durationMs / 1_000))} 秒
              </p>
            </div>
          </div>
          <time className="shrink-0 text-[10px] text-muted">{new Date(focusAttempt.createdAt).toLocaleString('zh-CN')}</time>
        </section>
      ) : null}

      <section className="grid min-h-[660px] overflow-hidden rounded-md border border-border bg-card min-[1100px]:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <aside className="border-b border-border bg-surface p-4 min-[1100px]:border-b-0 min-[1100px]:border-r">
          <div className="mb-4 flex items-center justify-between text-xs text-muted">
            <span>任务</span><span>{completed.size} / {SQL_CHALLENGES.length}</span>
          </div>
          <nav aria-label="SQL 任务列表" className="space-y-1">
            {SQL_CHALLENGES.map((item, index) => {
              const active = item.id === challenge.id;
              const done = completed.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectChallenge(item)}
                  className={`flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left ${active ? 'bg-card shadow-sm' : 'hover:bg-card/70'}`}
                >
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${done ? 'bg-accent/15 text-accent' : 'border border-border text-muted'}`}>
                    {done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </span>
                  <span className="min-w-0"><strong className="block truncate text-sm font-medium">{item.title}</strong><span className="text-[11px] text-muted">{item.difficulty} · {item.skills[0]}</span></span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-semibold">当前任务</p>
            <p className="mt-2 text-sm leading-6 text-card-foreground/85">{challenge.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {challenge.skills.map((skill) => <span key={skill} className="rounded bg-card px-2 py-1 text-[10px] text-muted">{skill}</span>)}
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">分级提示</p>
              <span className="text-[11px] text-muted">{hintCount} / {challenge.hints.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {challenge.hints.slice(0, hintCount).map((hint, index) => (
                <p key={hint} className="border-l-2 border-yellow px-2 text-xs leading-5"><span className="text-muted">{index + 1}. </span>{hint}</p>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              disabled={hintCount >= challenge.hints.length}
              onClick={() => setHintCount((count) => Math.min(challenge.hints.length, count + 1))}
            >
              <Lightbulb className="size-4" />查看下一条提示
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <section className="border-b border-border px-5 py-4" aria-labelledby="schema-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="schema-title" className="flex items-center gap-2 text-xs font-semibold"><TableProperties className="size-4 text-accent" />Schema</h2>
              <span className="text-[11px] text-muted">每次运行重新载入种子数据</span>
            </div>
            <div className="space-y-2">
              {challenge.schema.map((table) => (
                <div key={table.table} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-xs">
                  <code className="font-semibold text-accent">{table.table}</code>
                  <span><span className="block font-mono text-card-foreground">{table.columns}</span><span className="mt-0.5 block text-muted">{table.sample}</span></span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col px-5 py-4" aria-labelledby="editor-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="editor-title" className="flex items-center gap-2 text-xs font-semibold"><Code2 className="size-4 text-primary" />SQL 编辑器</h2>
              <span className="text-[11px] text-muted">已运行 {runCount} 次</span>
            </div>
            <textarea
              aria-label="SQL 编辑器"
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              spellCheck={false}
              className="min-h-72 flex-1 resize-none rounded-md border border-border bg-[#111318] p-4 font-mono text-sm leading-6 text-[#e7e9ee] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="size-4" />重置</Button>
                <Button variant="ghost" size="sm" onClick={() => { setHintCount(challenge.hints.length); setSolutionOpen(true); }}><Eye className="size-4" />查看解法</Button>
              </div>
              <Button onClick={run} loading={busy} disabled={!sql.trim()}><Play className="size-4" />运行并验证</Button>
            </div>
          </section>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-border bg-surface p-4 min-[1100px]:border-l min-[1100px]:border-t-0" aria-labelledby="result-title">
          <div className="flex items-center justify-between">
            <h2 id="result-title" className="flex items-center gap-2 text-xs font-semibold"><Rows3 className="size-4 text-accent" />验证结果</h2>
            <span className="text-[11px] text-muted">最多 100 行</span>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {busy ? <ResultPending /> : null}
            {runError ? <ResultError error={runError} /> : null}
            {!busy && !runError && validation ? (
              <div className={`mb-4 rounded-md border px-3 py-3 ${validation.passed ? 'border-accent/30 bg-accent/8' : 'border-yellow/50 bg-yellow/10'}`}>
                <p className="flex items-center gap-2 text-sm font-semibold">{validation.passed ? <CheckCircle2 className="size-4 text-accent" /> : <CircleAlert className="size-4 text-yellow-foreground" />}{validation.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{validation.details}</p>
                {execution ? <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><Clock3 className="size-3" />Worker {execution.durationMs}ms · 修改 {execution.affectedRows} 行</p> : null}
              </div>
            ) : null}
            {resultSet ? <ResultTable result={resultSet} /> : null}
            {!busy && !runError && !validation ? (
              <div className="grid min-h-60 place-items-center text-center text-xs text-muted">
                <div><Play className="mx-auto mb-2 size-5" /><p>运行 SQL 后在这里查看<br />结果集与任务验证</p></div>
              </div>
            ) : null}
          </div>

          {validation?.passed && nextChallenge ? (
            <Button className="mt-4 w-full" onClick={() => selectChallenge(nextChallenge)}>
              下一题<ChevronRight className="size-4" />
            </Button>
          ) : null}
          {validation?.passed && !nextChallenge ? (
            <p className="mt-4 rounded-md bg-accent/10 px-3 py-2 text-center text-xs font-medium text-accent">本组任务已完成</p>
          ) : null}
        </aside>
      </section>

      <Dialog open={solutionOpen} onOpenChange={setSolutionOpen}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold">参考解法</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">先理解筛选、分组或副作用条件，再回到编辑器重写。</DialogDescription>
          <pre className="mt-5 overflow-x-auto rounded-md bg-[#111318] p-4 font-mono text-sm leading-6 text-[#e7e9ee]"><code>{challenge.solution}</code></pre>
          <div className="mt-5 flex justify-end"><Button onClick={() => { setSql(challenge.solution); setSolutionOpen(false); }}>放入编辑器</Button></div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function attemptPayload({
  challenge,
  conceptId,
  sql,
  runCount,
  hintCount,
  durationMs,
  validation,
}: {
  challenge: SqlChallenge;
  conceptId: string | null;
  sql: string;
  runCount: number;
  hintCount: number;
  durationMs: number;
  validation: ChallengeValidation;
}): AttemptPayload {
  return {
    challengeId: challenge.id,
    conceptId,
    status: validation.passed ? 'success' : 'error',
    errorType: validation.passed ? null : 'validation',
    runCount,
    hintCount,
    durationMs,
    sql,
    result: { title: validation.title, details: validation.details },
    skills: challenge.skills,
    idempotencyKey: createIdempotencyKey('practice-attempt'),
  };
}

function classifySqlError(error: unknown): RunErrorType {
  if (error instanceof SqlExecutionTimeoutError) return 'timeout';
  const message = error instanceof Error ? error.message.toLocaleLowerCase() : String(error).toLocaleLowerCase();
  return message.includes('syntax') || message.includes('no such') ? 'syntax' : 'runtime';
}

function lastVisibleResult(challenge: SqlChallenge, execution: SqlExecutionResult | null) {
  if (!execution) return null;
  const results = challenge.expectedResult.kind === 'state' ? execution.verification : execution.results;
  return results.at(-1) ?? null;
}

function ResultPending() {
  return <div className="grid min-h-60 place-items-center text-xs text-muted"><span className="animate-pulse">Worker 正在执行并验证</span></div>;
}

function ResultError({ error }: { error: { type: RunErrorType; message: string } }) {
  const labels: Record<RunErrorType, string> = { syntax: '语法错误', runtime: '运行错误', timeout: '执行超时', validation: '结果未通过' };
  return <div role="alert" className="rounded-md border border-danger/35 bg-danger/8 p-3"><p className="font-semibold text-danger">{labels[error.type]}</p><pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-card-foreground">{error.message}</pre></div>;
}

function ResultTable({ result }: { result: SqlResultSet }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead><tr className="border-b border-border bg-card-soft">{result.columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{column}</th>)}</tr></thead>
        <tbody>{result.values.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border/60 last:border-0">{row.map((value, columnIndex) => <td key={columnIndex} className="px-3 py-2 font-mono">{formatValue(value)}</td>)}</tr>)}</tbody>
      </table>
      {result.truncated ? <p className="border-t border-border px-3 py-2 text-[11px] text-muted">结果超过 100 行，已截断显示。</p> : null}
    </div>
  );
}

function formatValue(value: SqlValue) {
  if (value === null) return 'NULL';
  if (value instanceof Uint8Array) return '(blob)';
  return String(value);
}
