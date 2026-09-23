import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { DeckForm } from '@/components/DeckForm';
import { countCardsInDeck, getDeck, type Deck } from '@/db/queries';
import { goBack } from '@/lib/nav';

/** /deck/3/edit — rename, restyle or delete a deck. */
export default function EditDeck() {
  const db = useSQLiteContext();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const [loaded, setLoaded] = useState<{ deck: Deck; cardCount: number } | null>(null);

  useEffect(() => {
    const id = Number(deckId);
    Promise.all([getDeck(db, id), countCardsInDeck(db, id)]).then(([deck, cardCount]) =>
      deck ? setLoaded({ deck, cardCount }) : goBack(),
    );
  }, [db, deckId]);

  return loaded ? <DeckForm key={loaded.deck.id} deck={loaded.deck} cardCount={loaded.cardCount} /> : null;
}
