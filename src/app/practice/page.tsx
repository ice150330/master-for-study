import { PracticeView } from '@/components/practice/PracticeView';
import { getPracticeAttempt } from '@/lib/db';
import { parseLearningContext } from '@/lib/learning-context';

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; concept?: string; attempt?: string }>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.concept) search.set('concept', params.concept);
  if (params.attempt) search.set('attempt', params.attempt);
  const context = parseLearningContext(search);
  const focusAttempt = context.attempt?.type === 'practice'
    ? getPracticeAttempt(context.attempt.id)
    : undefined;
  const conceptId = context.conceptId ?? focusAttempt?.conceptId ?? null;
  return (
    <PracticeView
      initialChallengeId={focusAttempt?.challengeId ?? params.challenge}
      conceptId={conceptId}
      focusAttempt={focusAttempt ? { ...focusAttempt, createdAt: focusAttempt.createdAt.toISOString() } : null}
    />
  );
}
