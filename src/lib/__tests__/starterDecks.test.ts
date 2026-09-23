import { STARTER_DECKS } from '@/data/starterDecks';
import { cardOrds, validateNote } from '@/lib/notes';

describe('starter decks', () => {
  it.each(STARTER_DECKS.map((d) => [d.name, d] as const))('%s: every note is complete and makes at least one card', (_name, deck) => {
    expect(deck.notes.length).toBeGreaterThanOrEqual(8);
    for (const { note } of deck.notes) {
      expect(validateNote(note)).toBeNull();
      expect(cardOrds(note).length).toBeGreaterThan(0);
    }
  });

  it('has unique ids and names, and covers every goal', () => {
    expect(new Set(STARTER_DECKS.map((d) => d.id)).size).toBe(STARTER_DECKS.length);
    expect(new Set(STARTER_DECKS.map((d) => d.name)).size).toBe(STARTER_DECKS.length);
    const goals = new Set(STARTER_DECKS.flatMap((d) => d.goals));
    expect([...goals].sort()).toEqual(['code', 'exam', 'language', 'medicine', 'other', 'university']);
  });
});
