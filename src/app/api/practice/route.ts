import { createPracticeAttempt, getTerm } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { practiceAttemptSchema } from '@/lib/validation/schemas';

/** 浏览器 SQL 运行证据写入；SQL 本身只在 Worker 中执行。 */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, practiceAttemptSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.conceptId && !getTerm(parsed.data.conceptId)) {
      throw new DomainError('CONCEPT_NOT_FOUND', '关联概念不存在', 404);
    }
    const attempt = createPracticeAttempt(parsed.data);
    return Response.json({ attempt }, { status: 201 });
  });
}
