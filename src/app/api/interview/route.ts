import { generateQuestion, judgeAnswer } from '@/lib/ai/interview';
import {
  createInterview,
  findEventByIdempotencyKey,
  finishInterview,
  getInterview,
  listInterviews,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { interviewRequestSchema } from '@/lib/validation/schemas';

/**
 * 模拟面试接口。
 *
 * GET  /api/interview —— 列出面试历史
 * POST /api/interview —— 出题 / 判分
 *    { action: 'question', context? }       → 返回 { interview }
 *    { action: 'answer', id, answer }       → 返回 { correct, feedback, level }
 */

export async function GET() {
  return withApiErrors(() => Response.json({ interviews: listInterviews() }));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, interviewRequestSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const previous = findEventByIdempotencyKey(body.idempotencyKey);

    if (body.action === 'question') {
      if (previous?.objectId) {
        const interview = getInterview(previous.objectId);
        if (interview) return Response.json({ interview });
      }
      const question = await generateQuestion(body.context);
      const interview = createInterview({
        question,
        idempotencyKey: body.idempotencyKey,
      });
      return Response.json({ interview }, { status: 201 });
    }

    const interview = getInterview(body.id);
    if (!interview) throw new DomainError('INTERVIEW_NOT_FOUND', '面试记录不存在', 404);
    if (previous?.result) {
      return Response.json({
        correct: interview.correct,
        feedback: interview.feedback,
        level: previous.result.level,
      });
    }

    const result = await judgeAnswer(interview.question, body.answer);
    finishInterview(body.id, {
      answer: body.answer,
      feedback: result.feedback,
      correct: result.correct,
      level: result.level,
      idempotencyKey: body.idempotencyKey,
    });
    return Response.json(result);
  });
}
