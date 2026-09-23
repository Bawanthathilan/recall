import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { NoteForm } from '@/components/NoteForm';
import { getNote, type NoteRow } from '@/db/queries';
import { goBack } from '@/lib/nav';
import { parseNote } from '@/lib/notes';

/** /card/12 — edit note 12 (and, through it, all of its cards). */
export default function EditCard() {
  const db = useSQLiteContext();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const [note, setNote] = useState<NoteRow | null>(null);

  useEffect(() => {
    getNote(db, Number(noteId)).then((n) => (n ? setNote(n) : goBack()));
  }, [db, noteId]);

  // `key` remounts the form once the note has loaded, so its fields start filled in.
  return note ? (
    <NoteForm key={note.id} noteId={note.id} initial={parseNote(note.type, note.fields)} initialDeckId={note.deck_id} initialTags={note.tags} />
  ) : null;
}
