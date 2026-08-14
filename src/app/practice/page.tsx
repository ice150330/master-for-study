import { PracticeView } from '@/components/practice/PracticeView';

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; concept?: string }>;
}) {
  const params = await searchParams;
  const conceptId = params.concept && /^[0-9a-f-]{36}$/i.test(params.concept) ? params.concept : null;
  return <PracticeView initialChallengeId={params.challenge} conceptId={conceptId} />;
}
