import { generateFollowUp, generateQuestion, judgeAnswer } from '@/lib/ai/interview';
import {
  createNextInterviewQuestion,
  findEventByIdempotencyKey,
  finishInterview,
  getInterview,
  getInterviewSession,
  getInterviewSessionDetail,
  listInterviewAttempts,
  listInterviewSessionDetails,
  saveInterviewFollowUp,
  startInterviewSession,
  upsertTerm,
  type InterviewAttempt,
} from '@/lib/db';
import type { InterviewEvaluation, InterviewSettings } from '@/lib/interview/types';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { interviewRequestSchema } from '@/lib/validation/schemas';

/** 结构化模拟面试：场次设置、追问、评分和自适应下一题均由服务端状态驱动。 */
export async function GET() {
  return withApiErrors(() => Response.json({ sessions: listInterviewSessionDetails() }));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, interviewRequestSchema);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const previous = findEventByIdempotencyKey(body.idempotencyKey);

    if (body.action === 'start') {
      if (previous?.objectId) {
        const detail = getInterviewSessionDetail(previous.objectId);
        if (detail) return Response.json({ detail });
      }
      const settings: InterviewSettings = {
        role: body.role,
        topic: body.topic,
        difficulty: body.difficulty,
        totalRounds: body.totalRounds,
        teacherStyle: body.teacherStyle,
      };
      const question = await generateQuestion({ settings, roundIndex: 1 });
      const term = upsertInterviewSkill(question.skill, body.idempotencyKey);
      const detail = startInterviewSession({
        settings,
        question,
        termId: term.id,
        idempotencyKey: body.idempotencyKey,
      });
      return Response.json({ detail }, { status: 201 });
    }

    if (body.action === 'next') {
      if (previous?.objectId) {
        const priorQuestion = getInterview(previous.objectId);
        if (priorQuestion?.interviewSessionId) {
          const detail = getInterviewSessionDetail(priorQuestion.interviewSessionId);
          if (detail) return Response.json({ detail });
        }
      }
      const detail = getInterviewSessionDetail(body.interviewSessionId);
      if (!detail) throw new DomainError('INTERVIEW_SESSION_NOT_FOUND', '面试场次不存在', 404);
      if (detail.session.status === 'completed' || detail.session.currentRound >= detail.session.totalRounds) {
        throw new DomainError('INTERVIEW_SESSION_COMPLETED', '当前面试已经完成', 409);
      }
      const previousQuestion = detail.questions.at(-1);
      const previousAttempt = previousQuestion?.attempts.at(-1);
      if (!previousAttempt) {
        throw new DomainError('INTERVIEW_ANSWER_REQUIRED', '请先完成当前题目', 409);
      }
      const settings: InterviewSettings = {
        role: detail.session.role,
        topic: detail.session.topic,
        difficulty: detail.session.currentDifficulty,
        totalRounds: detail.session.totalRounds as 3 | 5,
        teacherStyle: detail.session.teacherStyle,
      };
      const question = await generateQuestion({
        settings,
        roundIndex: detail.session.currentRound + 1,
        previousSummary: previousAttempt.summary,
        prerequisite: previousAttempt.nextStrategy === 'downgrade' ? previousAttempt.prerequisite : null,
      });
      const term = upsertInterviewSkill(question.skill, body.idempotencyKey);
      const nextDetail = createNextInterviewQuestion({
        interviewSessionId: detail.session.id,
        question,
        termId: term.id,
        idempotencyKey: body.idempotencyKey,
      });
      return Response.json({ detail: nextDetail }, { status: 201 });
    }

    const interview = getInterview(body.id);
    if (!interview) throw new DomainError('INTERVIEW_NOT_FOUND', '面试题目不存在', 404);

    if (body.action === 'followup') {
      if (previous && interview.followUp) return Response.json({ interview });
      const session = interview.interviewSessionId
        ? getInterviewSession(interview.interviewSessionId)
        : undefined;
      const followUp = await generateFollowUp({
        question: interview.question,
        answerDraft: body.answerDraft,
        teacherStyle: session?.teacherStyle ?? 'guided',
      });
      return Response.json({
        interview: saveInterviewFollowUp({
          interviewId: interview.id,
          followUp,
          idempotencyKey: body.idempotencyKey,
        }),
      });
    }

    const priorAttempt = previous?.objectId
      ? listInterviewAttempts(interview.id).find((attempt) => attempt.id === previous.objectId)
      : undefined;
    if (priorAttempt) return Response.json(answerResponse(interview.id, priorAttempt));
    const evaluation = await judgeAnswer({
      question: interview.question,
      answer: body.answer,
      difficulty: interview.difficulty,
      rubric: interview.rubric,
      followUp: interview.followUp,
    });
    const prerequisiteTerm = evaluation.nextStrategy === 'downgrade' && evaluation.prerequisite
      ? upsertInterviewSkill(evaluation.prerequisite, `${body.idempotencyKey}:prerequisite`)
      : null;
    const result = finishInterview(interview.id, {
      answer: body.answer,
      durationMs: body.durationMs,
      evaluation,
      prerequisiteTermId: prerequisiteTerm?.id,
      idempotencyKey: body.idempotencyKey,
    });
    return Response.json({ ...result, evaluation });
  });
}

function upsertInterviewSkill(name: string, idempotencyKey: string) {
  return upsertTerm({
    name,
    canonicalName: name,
    definition: `模拟面试中正在验证的能力点：${name}。`,
    confidence: 0.3,
    idempotencyKey: `${idempotencyKey}:skill`,
  });
}

function answerResponse(interviewId: string, attempt: InterviewAttempt) {
  const interview = getInterview(interviewId) as NonNullable<ReturnType<typeof getInterview>>;
  const session = interview.interviewSessionId
    ? getInterviewSession(interview.interviewSessionId) ?? null
    : null;
  return {
    session,
    interview,
    attempt,
    attempts: listInterviewAttempts(interviewId),
    evaluation: attemptEvaluation(attempt),
  };
}

function attemptEvaluation(attempt: InterviewAttempt): InterviewEvaluation {
  return {
    correct: attempt.correct,
    scores: attempt.scores,
    summary: attempt.summary,
    strengths: attempt.strengths,
    improvements: attempt.improvements,
    evidence: attempt.evidence,
    modelAnswer: attempt.modelAnswer,
    nextStrategy: attempt.nextStrategy,
    prerequisite: attempt.prerequisite,
  };
}
