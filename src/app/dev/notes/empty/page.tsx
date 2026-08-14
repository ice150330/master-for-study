import { NotesView } from '@/components/notes/NotesView';

export default function EmptyNotesFixturePage() {
  return <NotesView initialNotes={[]} initialSessions={[]} initialTerms={[]} />;
}
