import { Suspense } from 'react';
import { NotesView } from '@/components/notes/NotesView';

export default function EmptyNotesFixturePage() {
  return (
    <Suspense fallback={null}>
      <NotesView initialNotes={[]} initialSessions={[]} initialTerms={[]} />
    </Suspense>
  );
}
