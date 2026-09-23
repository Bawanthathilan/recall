import {
  cardOrds,
  checkTypedAnswer,
  clozeNumbers,
  emptyNote,
  nextClozeNumber,
  notePreview,
  parseNote,
  parseTags,
  validateNote,
  type NoteData,
} from '@/lib/notes';

describe('cardOrds', () => {
  it('gives a basic note one card, or two when reversed', () => {
    expect(cardOrds({ type: 'basic', fields: { front: 'a', back: 'b', reverse: false } })).toEqual([0]);
    expect(cardOrds({ type: 'basic', fields: { front: 'a', back: 'b', reverse: true } })).toEqual([0, 1]);
  });

  it('gives a cloze note one card per distinct cloze number', () => {
    const note: NoteData = { type: 'cloze', fields: { text: '{{c2::b}} {{c1::a}} {{c2::again}}', extra: '' } };
    expect(cardOrds(note)).toEqual([1, 2]);
  });

  it('gives code notes a single card', () => {
    expect(cardOrds(emptyNote('code'))).toEqual([0]);
  });
});

describe('cloze numbers', () => {
  it('reads hints and ignores c0', () => {
    expect(clozeNumbers('{{c3::x::hint}} {{c0::no}} plain')).toEqual([3]);
  });

  it('suggests the next free number', () => {
    expect(nextClozeNumber('no clozes')).toBe(1);
    expect(nextClozeNumber('{{c1::a}} {{c4::b}}')).toBe(5);
  });
});

describe('validateNote', () => {
  it('requires at least one cloze', () => {
    expect(validateNote({ type: 'cloze', fields: { text: 'no blanks', extra: '' } })).toMatch(/Cloze/);
    expect(validateNote({ type: 'cloze', fields: { text: 'a {{c1::blank}}', extra: '' } })).toBeNull();
  });

  it('requires word and meaning for vocab', () => {
    const note = emptyNote('vocab');
    expect(validateNote(note)).not.toBeNull();
    if (note.type === 'vocab') Object.assign(note.fields, { word: '勉強する', meaning: 'to study' });
    expect(validateNote(note)).toBeNull();
  });
});

describe('parseNote', () => {
  it('fills missing fields with defaults', () => {
    expect(parseNote('basic', '{"front":"Q"}')).toEqual({ type: 'basic', fields: { front: 'Q', back: '', reverse: false } });
  });

  it('survives corrupt JSON and unknown types', () => {
    expect(parseNote('mystery', '{oops')).toEqual(emptyNote('basic'));
  });
});

describe('notePreview', () => {
  it('shows cloze answers and strips markup', () => {
    expect(notePreview({ type: 'cloze', fields: { text: 'The **{{c1::heart}}** pumps\n{{c2::blood::fluid}}', extra: '' } })).toBe(
      'The heart pumps blood',
    );
  });
});

describe('parseTags', () => {
  it('splits on commas and spaces, lowercases and de-duplicates', () => {
    expect(parseTags('Closures, scope  #Async scope')).toEqual(['closures', 'scope', 'async']);
  });
});

describe('checkTypedAnswer', () => {
  it('accepts any listed alternative', () => {
    expect(checkTypedAnswer('learn', 'to study, to learn')).toBe(true);
  });

  it('ignores case, accents, punctuation and a leading "to"', () => {
    expect(checkTypedAnswer('To Study!', 'to study')).toBe(true);
    expect(checkTypedAnswer('cafe', 'café')).toBe(true);
  });

  it('rejects wrong and empty answers', () => {
    expect(checkTypedAnswer('to eat', 'to study, to learn')).toBe(false);
    expect(checkTypedAnswer('   ', 'to study')).toBe(false);
  });
});
