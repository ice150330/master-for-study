import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestJson } from '../../src/lib/http/client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HTTP 客户端', () => {
  it('把非 2xx JSON 错误转换为统一 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: '资源地址无效', code: 'INVALID_URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const promise = requestJson('/api/resources');
    await expect(promise).rejects.toMatchObject({
      name: 'ApiError',
      message: '资源地址无效',
      status: 400,
      code: 'INVALID_URL',
    });
  });

  it('为服务端 500 保留可操作错误文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('AI 服务暂时不可用', { status: 500 })),
    );

    await expect(requestJson('/api/chat')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'AI 服务暂时不可用',
      status: 500,
    } satisfies Partial<ApiError>);
  });

  it('读取标准嵌套错误中的 code、message 和 details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: '请求参数不符合要求',
              details: [{ path: 'type', message: 'Invalid option' }],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(requestJson('/api/resources')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '请求参数不符合要求',
      details: [{ path: 'type', message: 'Invalid option' }],
    });
  });

  it('超时后中止底层请求并返回明确错误', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestJson('/api/slow', { timeoutMs: 5 })).rejects.toMatchObject({
      status: 408,
      code: 'REQUEST_TIMEOUT',
      message: '请求超时，请稍后重试',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
