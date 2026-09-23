import { create } from 'zustand';

import type { StudyCard } from '@/db/queries';
import type { Typed } from '@/lib/notes';

/**
 * If a card you just rated comes due again within this window (e.g. "Again"
 * → 1 min), it goes back to the end of this session's queue instead of
 * disappearing until you next open the app. Anki calls this "learn ahead".
 */
const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** What we need to reverse one rating. */
type HistoryEntry = { before: StudyCard; logId: number };

type StudySessionState = {
  queue: StudyCard[];
  revealed: boolean;
  /** What you typed on a vocab card, and whether it matched. Reset for each card. */
  typed: Typed | null;
  reviewed: number;
  history: HistoryEntry[];
  /** When the current card was shown — used to log how long you took. */
  shownAt: number;
  start: (cards: StudyCard[]) => void;
  reveal: (typed?: Typed) => void;
  /** Call after saving a rating. */
  advance: (before: StudyCard, updated: StudyCard, logId: number) => void;
  /** Call after the database undo succeeded. */
  undo: () => void;
  /** Replace one card (after flagging it). */
  patchCard: (card: StudyCard) => void;
  /**
   * After editing: take each card's *content* (fields, tags, deck, flag) from
   * fresh database rows, keep its in-session scheduling, and drop cards that
   * no longer exist (note deleted, cloze removed, "reversed" unticked).
   */
  refreshCards: (fresh: StudyCard[]) => void;
};

export const useStudySession = create<StudySessionState>()((set) => ({
  queue: [],
  revealed: false,
  typed: null,
  reviewed: 0,
  history: [],
  shownAt: Date.now(),

  start: (cards) => set({ queue: cards, revealed: false, typed: null, reviewed: 0, history: [], shownAt: Date.now() }),

  reveal: (typed) => set({ revealed: true, typed: typed ?? null }),

  advance: (before, updated, logId) =>
    set((s) => {
      const rest = s.queue.slice(1);
      const again = updated.due - Date.now() <= LEARN_AHEAD_MS;
      return {
        queue: again ? [...rest, updated] : rest,
        revealed: false,
        typed: null,
        reviewed: s.reviewed + 1,
        history: [...s.history, { before, logId }],
        shownAt: Date.now(),
      };
    }),

  undo: () =>
    set((s) => {
      const last = s.history.at(-1);
      if (!last) return s;
      // Drop the re-queued copy (if any), then put the old version back in front, answer showing.
      const rest = s.queue.filter((c) => c.id !== last.before.id);
      return {
        queue: [last.before, ...rest],
        revealed: true,
        typed: null,
        reviewed: s.reviewed - 1,
        history: s.history.slice(0, -1),
        shownAt: Date.now(),
      };
    }),

  patchCard: (card) => set((s) => ({ queue: s.queue.map((c) => (c.id === card.id ? card : c)) })),

  refreshCards: (fresh) =>
    set((s) => {
      const byId = new Map(fresh.map((c) => [c.id, c]));
      const withContent = (c: StudyCard): StudyCard | null => {
        const f = byId.get(c.id);
        return f ? { ...c, deck_id: f.deck_id, note_type: f.note_type, fields: f.fields, tags: f.tags, flagged: f.flagged } : null;
      };
      const queue = s.queue.map(withContent).filter((c): c is StudyCard => c !== null);
      const history = s.history.flatMap((h) => {
        const before = withContent(h.before);
        return before ? [{ ...h, before }] : []; // its logs were cascade-deleted with it
      });
      const sameCard = queue[0]?.id === s.queue[0]?.id;
      return { queue, history, revealed: sameCard && s.revealed, typed: sameCard ? s.typed : null };
    }),
}));
