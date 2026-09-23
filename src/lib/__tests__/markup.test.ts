import { insertCodeBlock, parseInline, parseMarkup, wrapSelection } from '@/lib/markup';

describe('parseMarkup', () => {
  it('splits fenced code blocks from text', () => {
    const blocks = parseMarkup('What does this log?\n```js\nconsole.log(1)\n```\nThink about it.');
    expect(blocks).toEqual([
      { kind: 'text', spans: [{ text: 'What does this log?' }] },
      { kind: 'code', language: 'js', code: 'console.log(1)' },
      { kind: 'text', spans: [{ text: 'Think about it.' }] },
    ]);
  });

  it('allows a fence without a language', () => {
    expect(parseMarkup('```\nx\n```')).toEqual([{ kind: 'code', language: '', code: 'x' }]);
  });
});

describe('parseInline', () => {
  it('handles bold and inline code', () => {
    expect(parseInline('use **let**, not `var`')).toEqual([
      { text: 'use ' },
      { text: 'let', bold: true },
      { text: ', not ' },
      { text: 'var', code: true },
    ]);
  });

  it('hides only the cloze this card tests', () => {
    const text = 'The {{c1::heart}} pumps {{c2::blood::fluid}}';
    expect(parseInline(text, { ord: 2, revealed: false })).toEqual([
      { text: 'The heart pumps ' },
      { text: '[fluid]', cloze: 'hidden' },
    ]);
    expect(parseInline(text, { ord: 1, revealed: false })[1]).toEqual({ text: '[…]', cloze: 'hidden' });
    expect(parseInline(text, { ord: 1, revealed: true })[1]).toEqual({ text: 'heart', cloze: 'revealed' });
  });

  it('shows cloze answers as plain text when not studying', () => {
    expect(parseInline('a {{c1::b}} c')).toEqual([{ text: 'a b c' }]);
  });

  it('hides a cloze that sits inside inline code', () => {
    expect(parseInline('`{{c1::map}}` returns', { ord: 1, revealed: false })).toEqual([
      { text: '[…]', code: true, cloze: 'hidden' },
      { text: ' returns' },
    ]);
    expect(parseInline('`{{c1::map}}`', { ord: 1, revealed: true })).toEqual([{ text: 'map', code: true, cloze: 'revealed' }]);
  });

  it('keeps formatting inside a revealed cloze', () => {
    expect(parseInline('{{c1::**big**}}', { ord: 1, revealed: true })).toEqual([{ text: 'big', bold: true, cloze: 'revealed' }]);
  });

  it('treats unpaired markers as plain text', () => {
    expect(parseInline("it's a ` tick")).toEqual([{ text: "it's a ` tick" }]);
    expect(parseInline('`std::vector` and }}')).toEqual([{ text: 'std::vector', code: true }, { text: ' and }}' }]);
    expect(parseInline('{{c1::never closed')).toEqual([{ text: '{{c1::never closed' }]);
  });
});

describe('editing helpers', () => {
  it('wraps the selection and selects the wrapped text', () => {
    expect(wrapSelection('hello world', { start: 6, end: 11 }, '**', '**')).toEqual({
      text: 'hello **world**',
      selection: { start: 8, end: 13 },
    });
  });

  it('inserts a placeholder when nothing is selected', () => {
    expect(wrapSelection('ab', { start: 1, end: 1 }, '{{c1::', '}}', 'answer').text).toBe('a{{c1::answer}}b');
  });

  it('puts a code block on its own lines', () => {
    expect(insertCodeBlock('before after', { start: 7, end: 7 }, 'js').text).toBe('before \n```js\ncode\n```\nafter');
  });
});
