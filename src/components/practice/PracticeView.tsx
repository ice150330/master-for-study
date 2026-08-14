'use client';

import { useRef, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { createIdempotencyKey } from '@/lib/http/idempotency';

/**
 * SQL 实验沙盒：用 sql.js（SQLite 编译到 WASM）在浏览器里跑 SQL。
 * 零安装、断网可用、隔离安全；每次运行记一条 code_run 事件（实践写进记忆）。
 */

const SEED_SQL = `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, score INTEGER);
INSERT INTO students (name, score) VALUES
  ('Alice', 92), ('Bob', 85), ('Carol', 78), ('Dave', 66), ('Eve', 71);
`.trim();

const SAMPLE_QUERIES = [
  'SELECT * FROM students;',
  'SELECT * FROM students WHERE score >= 80;',
  'SELECT AVG(score) AS 平均分 FROM students;',
  'SELECT COUNT(*) AS 人数 FROM students;',
];

type QueryResult = { columns: string[]; values: unknown[][] };

export function PracticeView() {
  const dbRef = useRef<Database | null>(null);
  const [sql, setSql] = useState('SELECT * FROM students;');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ensureDb(): Promise<Database> {
    if (dbRef.current) return dbRef.current;
    const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
    const db = new SQL.Database();
    db.run(SEED_SQL);
    dbRef.current = db;
    return db;
  }

  async function run() {
    if (!sql.trim() || busy) return;
    setBusy(true);
    setError(null);
    setRan(true);
    try {
      const db = await ensureDb();
      const res = db.exec(sql);
      setResults(res.map((r) => ({ columns: r.columns, values: r.values })));

      // 实践写进记忆
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'code_run',
          result: { success: true },
          context: { language: 'sql' },
          idempotencyKey: createIdempotencyKey('code-run'),
        }),
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="实践区 · SQL 沙盒" description="浏览器内跑 SQL（SQLite/WASM），零安装，随便试错">

      {/* 示例查询 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setSql(q)}
            className="rounded-lg bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>

      {/* 编辑器 */}
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={4}
        spellCheck={false}
        className="mb-3 w-full resize-y rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm text-card-foreground outline-none focus:border-primary"
      />

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={run}
          disabled={!sql.trim() || busy}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? '运行中…' : '运行'}
        </button>
      </div>

      {/* 结果 */}
      {error ? (
        <div className="rounded-xl bg-pink/20 p-4 font-mono text-sm text-foreground">
          <div className="mb-1 font-semibold">错误</div>
          {error}
        </div>
      ) : ran && results.length === 0 ? (
        <div className="rounded-xl bg-accent/20 p-4 text-sm text-foreground">
          ✓ 执行成功（无返回结果）
        </div>
      ) : (
        results.map((r, i) => (
          <div key={i} className="mb-4 overflow-x-auto rounded-xl bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  {r.columns.map((c) => (
                    <th key={c} className="px-4 py-2 font-semibold text-card-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.values.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/40 last:border-0">
                    {row.map((v, ci) => (
                      <td key={ci} className="px-4 py-2 text-card-foreground/80">
                        {formatValue(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {!ran && !error && (
        <p className="py-8 text-center text-sm text-muted">
          内置一张 students 表，点上方示例或输入 SQL，点「运行」查看结果
        </p>
      )}
    </PageShell>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Uint8Array) return '(blob)';
  return String(v);
}
