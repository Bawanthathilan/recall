import type { SQLiteDatabase } from 'expo-sqlite';
import { createEmptyCard, Rating, type Card } from 'ts-fsrs';

import { createDeck, createNote, setCardSchedule } from '@/db/queries';
import { fsrsCardToRow, scheduler } from '@/lib/fsrs';
import type { VocabFields } from '@/lib/notes';

/** Backticks mark inline code; the card renderer shows them in JetBrains Mono. */
const SAMPLE_CARDS: [front: string, back: string][] = [
  ['What does `const` guarantee about a variable?', 'The binding can’t be reassigned. The value itself can still be mutated (e.g. pushing to a `const` array).'],
  ['What is the difference between `==` and `===`?', '`===` compares value and type with no coercion. `==` coerces types first, so `0 == ""` is `true`.'],
  ['What does `Array.prototype.map` return?', 'A new array of the same length, with the callback applied to each element. The original is unchanged.'],
  ['What is a closure?', 'A function bundled with references to the variables in the scope where it was created, so it can use them after that scope has returned.'],
  ['What is the value of `typeof null`?', '`"object"` — a long-standing bug kept for backwards compatibility.'],
  ['What does the `?.` operator do?', 'Optional chaining: `a?.b` returns `undefined` instead of throwing if `a` is `null` or `undefined`.'],
  ['What does the `??` operator do?', 'Nullish coalescing: `a ?? b` returns `b` only when `a` is `null` or `undefined` (unlike `||`, which also skips `0` and `""`).'],
  ['What does `await` do inside an `async` function?', 'Pauses that function until the promise settles, then resumes with its value (or throws its error).'],
  ['What is event delegation?', 'Handling events for many children with a single listener on a common ancestor, using `event.target` to see which child fired.'],
  ['How do you shallow-copy an object?', '`{ ...obj }` or `Object.assign({}, obj)`. Nested objects are still shared.'],
  ['What does `Promise.all` do if one promise rejects?', 'It rejects immediately with that error. Use `Promise.allSettled` to wait for every result.'],
  ['What is hoisting?', 'Declarations are moved to the top of their scope. `var` is hoisted as `undefined`; `let`/`const` are hoisted but unusable until declared (the temporal dead zone).'],
  ['What does `Array.prototype.reduce` do?', 'Walks the array, passing an accumulator and each element to a callback, and returns the final accumulator.'],
  ['What does `this` refer to inside an arrow function?', 'Whatever `this` was in the enclosing scope. Arrow functions don’t bind their own `this`.'],
];

/** How many of the sample cards start "already learned" and due for review today. */
const PRE_REVIEWED = 4;

/**
 * Replays a few "Good" reviews starting in the past, using the real scheduler,
 * so the card has a realistic FSRS state and is due by `now`.
 */
function agedCard(now: Date, daysAgo: number): Card {
  let t = new Date(now.getTime() - daysAgo * 86_400_000);
  let card = createEmptyCard(t);
  for (;;) {
    const next = scheduler.next(card, t, Rating.Good).card;
    if (next.due.getTime() > now.getTime()) return card; // stop while still due
    card = next;
    t = next.due;
  }
}

const CODE_SAMPLE = {
  prompt: 'What does this code log to the console?',
  language: 'javascript',
  code: 'for (var i = 0; i < 3; i++) {\n  setTimeout(() => {\n    console.log(i);\n  }, 0);\n}',
  answer: '3, 3, 3',
  explanation:
    '`var` is function-scoped, so all three callbacks share one `i`, which is 3 by the time they run. Using `let` gives each iteration its own binding and logs 0, 1, 2.',
};

const CLOZE_SAMPLES = [
  { tags: ['arrays'], fields: { text: '`{{c1::map}}` returns a new array; `{{c2::forEach}}` returns `undefined`.', extra: 'Use forEach only for side effects.' } },
  { tags: ['async'], fields: { text: 'A **{{c1::Promise}}** is in one of three states: pending, {{c2::fulfilled}} or {{c3::rejected}}.', extra: '' } },
];

const VOCAB_SAMPLES: Omit<VocabFields, 'reverse'>[] = [
  { word: '勉強する', reading: 'べんきょうする', transliteration: 'benkyō suru', pos: 'Verb', meaning: 'to study, to learn', example: '毎日日本語を勉強します。' },
  { word: '食べる', reading: 'たべる', transliteration: 'taberu', pos: 'Verb', meaning: 'to eat', example: '朝ご飯を食べました。' },
  { word: '水', reading: 'みず', transliteration: 'mizu', pos: 'Noun', meaning: 'water', example: '水を一杯ください。' },
  { word: '先生', reading: 'せんせい', transliteration: 'sensei', pos: 'Noun', meaning: 'teacher', example: '先生に質問します。' },
  { word: '大きい', reading: 'おおきい', transliteration: 'ōkii', pos: 'Adjective', meaning: 'big, large', example: '大きい犬がいます。' },
  { word: '毎日', reading: 'まいにち', transliteration: 'mainichi', pos: 'Adverb', meaning: 'every day, daily', example: '毎日走ります。' },
];

/** Sample decks covering every note type. Run on first launch, or from Settings. */
export async function seedSampleDecks(db: SQLiteDatabase) {
  const now = new Date();
  const js = await createDeck(db, 'JavaScript Essentials', 'code-slash', 'blue', 'A sample deck to try the study loop.');

  for (const [i, [front, back]] of SAMPLE_CARDS.entries()) {
    const { cardIds } = await createNote(db, js, { type: 'basic', fields: { front, back, reverse: false } }, ['javascript'], now);
    if (i < PRE_REVIEWED) await setCardSchedule(db, cardIds[0], fsrsCardToRow(agedCard(now, 20 + i * 5)), now.getTime());
  }
  await createNote(db, js, { type: 'code', fields: CODE_SAMPLE }, ['closures', 'scope'], now);
  for (const { fields, tags } of CLOZE_SAMPLES) await createNote(db, js, { type: 'cloze', fields }, tags, now);

  const jp = await createDeck(db, 'Japanese Starter', 'language', 'orange', 'Sample vocabulary cards.');
  for (const v of VOCAB_SAMPLES) await createNote(db, jp, { type: 'vocab', fields: { ...v, reverse: true } }, ['jlpt-n5'], now);
}
