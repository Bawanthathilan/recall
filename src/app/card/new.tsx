import { useLocalSearchParams } from 'expo-router';

import { NoteForm } from '@/components/NoteForm';

/** /card/new or /card/new?deckId=3 (pre-selects that deck). */
export default function NewCard() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  return <NoteForm initialDeckId={deckId ? Number(deckId) : undefined} />;
}
