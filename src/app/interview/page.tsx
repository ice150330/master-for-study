import { InterviewView } from '@/components/interview/InterviewView';
import type { InterviewSessionDetailDto } from '@/components/interview/types';
import { listInterviewSessionDetails, type InterviewSessionDetail } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染，不做静态预渲染。
export const dynamic = 'force-dynamic';

export default function InterviewPage() {
  const initialSessions = listInterviewSessionDetails().map(serializeInterviewSession);
  return <InterviewView initialSessions={initialSessions} />;
}

function serializeInterviewSession(detail: InterviewSessionDetail): InterviewSessionDetailDto {
  return {
    session: {
      ...detail.session,
      createdAt: detail.session.createdAt.toISOString(),
      updatedAt: detail.session.updatedAt.toISOString(),
      completedAt: detail.session.completedAt?.toISOString() ?? null,
    },
    questions: detail.questions.map((question) => ({
      ...question,
      createdAt: question.createdAt.toISOString(),
      attempts: question.attempts.map((attempt) => ({
        ...attempt,
        createdAt: attempt.createdAt.toISOString(),
      })),
    })),
  };
}
