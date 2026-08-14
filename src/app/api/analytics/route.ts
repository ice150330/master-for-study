import { getLearningAnalytics } from '@/lib/db';
import { apiError, withApiErrors } from '@/lib/validation/api';
import { analyticsQuerySchema } from '@/lib/validation/schemas';

export async function GET(req: Request) {
  return withApiErrors(() => {
    const url = new URL(req.url);
    const parsed = analyticsQuerySchema.safeParse({
      days: url.searchParams.get('days') ?? undefined,
    });
    if (!parsed.success) return apiError('VALIDATION_ERROR', '分析时间范围无效', 400);
    return Response.json({ analytics: getLearningAnalytics(parsed.data.days) });
  });
}
