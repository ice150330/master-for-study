import { generateQuestion, judgeAnswer } from '@/lib/ai/interview';
import {
  createInterview,
  finishInterview,
  getInterview,
  listInterviews,
} from '@/lib/db';

/**
 * 模拟面试接口。
 *
 * GET  /api/interview —— 列出面试历史
 * POST /api/interview —— 出题 / 判分
 *    { action: 'question', context? }       → 返回 { interview }
 *    { action: 'answer', id, answer }       → 返回 { correct, feedback, level }
 */

export async function GET() {
  const interviews = listInterviews();
  return Response.json({ interviews });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: 'question' | 'answer';
    context?: string;
    id?: string;
    answer?: string;
  };

  if (body.action === 'question') {
    const question = await generateQuestion(body.context);
    const interview = createInterview({ question });
    return Response.json({ interview }, { status: 201 });
  }

  // action === 'answer'
  if (!body.id || !body.answer) {
    return Response.json({ error: '缺少 id 或 answer' }, { status: 400 });
  }
  const interview = getInterview(body.id);
  if (!interview) {
    return Response.json({ error: '面试记录不存在' }, { status: 404 });
  }

  const result = await judgeAnswer(interview.question, body.answer);
  finishInterview(body.id, {
    answer: body.answer,
    feedback: result.feedback,
    correct: result.correct,
  });

  return Response.json({
    correct: result.correct,
    feedback: result.feedback,
    level: result.level,
  });
}
