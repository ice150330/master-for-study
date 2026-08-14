export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

type ErrorPayload = {
  error?: string | {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
  code?: string;
  details?: unknown;
};

export type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => '');
}

function connectAbortSignal(controller: AbortController, signal?: AbortSignal | null) {
  if (!signal) return () => undefined;
  if (signal.aborted) controller.abort(signal.reason);
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

export async function request(input: RequestInfo | URL, options: RequestOptions = {}) {
  const { timeoutMs = 15_000, signal, ...init } = options;
  const controller = new AbortController();
  const disconnect = connectAbortSignal(controller, signal);
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (response.ok) return response;

    const payload = await readPayload(response);
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorPayload) : undefined;
    const nestedError =
      errorPayload?.error && typeof errorPayload.error === 'object' ? errorPayload.error : undefined;
    const message =
      (typeof errorPayload?.error === 'string' ? errorPayload.error : undefined) ||
      nestedError?.message ||
      errorPayload?.message ||
      (typeof payload === 'string' && payload.trim()) ||
      `请求失败（${response.status}）`;

    throw new ApiError(message, {
      status: response.status,
      code: nestedError?.code ?? errorPayload?.code,
      details: nestedError?.details ?? errorPayload?.details,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError('请求超时，请稍后重试', { status: 408, code: 'REQUEST_TIMEOUT' });
    }
    if (controller.signal.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError('暂时无法连接服务，请检查网络后重试', {
      status: 0,
      code: 'NETWORK_ERROR',
      details: error,
    });
  } finally {
    globalThis.clearTimeout(timer);
    disconnect();
  }
}

export async function requestJson<T>(input: RequestInfo | URL, options: RequestOptions = {}) {
  const response = await request(input, options);
  return (await response.json()) as T;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
