import { getTokenUsageSummary } from '@/lib/db';
import { withApiErrors } from '@/lib/validation/api';

/** Token 用量摘要（C3 成本感知）：今日与累计，仅统计助手消息。 */
export async function GET() {
  return withApiErrors(() => {
    return Response.json({ usage: getTokenUsageSummary() });
  });
}
