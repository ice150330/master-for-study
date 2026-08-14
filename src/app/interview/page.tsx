import { InterviewView } from '@/components/interview/InterviewView';
import { listInterviews } from '@/lib/db';

// 本地 SQLite 数据，每次请求实时渲染，不做静态预渲染。
export const dynamic = 'force-dynamic';

export default function InterviewPage() {
  const interviews = listInterviews().map((i) => ({
    id: i.id,
    question: i.question,
    answer: i.answer,
    feedback: i.feedback,
    correct: i.correct,
    createdAt: i.createdAt.toISOString(),
  }));

  return <InterviewView initialInterviews={interviews} />;
}
