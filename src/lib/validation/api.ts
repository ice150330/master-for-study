import { ZodError, type ZodType } from 'zod';

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return Response.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export async function parseJson<T>(request: Request, schema: ZodType<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false as const,
      response: apiError('INVALID_JSON', '请求体必须是有效 JSON', 400),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false as const,
      response: apiError(
        'VALIDATION_ERROR',
        '请求参数不符合要求',
        400,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      ),
    };
  }

  return { success: true as const, data: result.data };
}

export async function withApiErrors(handler: () => Promise<Response> | Response) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    if (error instanceof ZodError) {
      return apiError('VALIDATION_ERROR', '请求参数不符合要求', 400, error.issues);
    }
    console.error('API 未处理异常：', error);
    return apiError('INTERNAL_ERROR', '服务暂时不可用，请稍后重试', 500);
  }
}
