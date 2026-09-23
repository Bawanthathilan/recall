import { createEmptyCard } from 'ts-fsrs';

import { formatInterval, fsrsCardToRow, previewRatings, Rating, rowToFsrsCard } from '@/lib/fsrs';

describe('formatInterval', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it('writes intervals out like the mockup', () => {
    expect(formatInterval(later(1), now)).toBe('1 min');
    expect(formatInterval(later(180), now)).toBe('3 hr');
    expect(formatInterval(later(60 * 24), now)).toBe('1 day');
    expect(formatInterval(later(60 * 24 * 5), now)).toBe('5 days');
    expect(formatInterval(later(60 * 24 * 90), now)).toBe('3 mo');
  });
});

describe('row conversion', () => {
  it('round-trips a card through the database shape', () => {
    const card = createEmptyCard(new Date('2026-01-01T00:00:00Z'));
    expect(rowToFsrsCard(fsrsCardToRow(card))).toEqual({ ...card, last_review: undefined });
  });
});

describe('previewRatings', () => {
  it('schedules a new card longer for better ratings', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const p = previewRatings(fsrsCardToRow(createEmptyCard(now)), now);
    const due = (g: keyof typeof p) => p[g].card.due.getTime();
    expect(due(Rating.Again)).toBeLessThan(due(Rating.Hard));
    expect(due(Rating.Hard)).toBeLessThan(due(Rating.Good));
    expect(due(Rating.Good)).toBeLessThan(due(Rating.Easy));
  });
});
