import type { SqlExecutionResult, SqlWorkerRequest, SqlWorkerResponse } from './types';

export class SqlExecutionTimeoutError extends Error {
  constructor(message: string, readonly durationMs: number) {
    super(message);
  }
}

export class SqlWorkerExecutionError extends Error {
  constructor(message: string, readonly durationMs: number) {
    super(message);
  }
}

export class SqlWorkerClient {
  private worker: Worker | null = null;

  async execute(
    input: Omit<SqlWorkerRequest, 'id'>,
    timeoutMs = 1_500,
  ): Promise<SqlExecutionResult> {
    const id = crypto.randomUUID();
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.restartWorker();
        reject(new SqlExecutionTimeoutError(`SQL 执行超过 ${timeoutMs}ms，已终止本次运行`, timeoutMs));
      }, timeoutMs);
      const onMessage = (event: MessageEvent<SqlWorkerResponse>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        if (event.data.ok) resolve(event.data.result);
        else reject(new SqlWorkerExecutionError(event.data.error, event.data.durationMs));
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ ...input, id } satisfies SqlWorkerRequest);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('../../workers/sql.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.worker;
  }

  private restartWorker() {
    this.worker?.terminate();
    this.worker = null;
  }
}
