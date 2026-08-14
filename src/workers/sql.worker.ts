/// <reference lib="webworker" />

import initSqlJs from 'sql.js';
import type { QueryExecResult } from 'sql.js';
import type {
  SqlResultSet,
  SqlWorkerRequest,
  SqlWorkerResponse,
} from '@/lib/practice/types';

const workerScope = self as DedicatedWorkerGlobalScope;
const sqlPromise = initSqlJs({
  locateFile: () => new URL('/sql-wasm.wasm', workerScope.location.origin).toString(),
});

workerScope.onmessage = async (event: MessageEvent<SqlWorkerRequest>) => {
  const request = event.data;
  const startedAt = performance.now();
  try {
    const SQL = await sqlPromise;
    const db = new SQL.Database();
    try {
      db.run(request.seedSql);
      db.run('CREATE TEMP TABLE IF NOT EXISTS __mentor_change_reset (value INTEGER);');
      db.run('DELETE FROM __mentor_change_reset;');
      const results = limitResults(db.exec(request.sql), request.rowLimit);
      const affectedRows = db.getRowsModified();
      const verification = request.verificationSql
        ? limitResults(db.exec(request.verificationSql), request.rowLimit)
        : [];
      respond({
        id: request.id,
        ok: true,
        result: {
          results,
          verification,
          affectedRows,
          durationMs: Math.round(performance.now() - startedAt),
        },
      });
    } finally {
      db.close();
    }
  } catch (error) {
    respond({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - startedAt),
    });
  }
};

function limitResults(results: QueryExecResult[], rowLimit: number): SqlResultSet[] {
  return results.map((result) => ({
    columns: result.columns,
    values: result.values.slice(0, rowLimit),
    truncated: result.values.length > rowLimit,
  }));
}

function respond(response: SqlWorkerResponse) {
  workerScope.postMessage(response);
}
