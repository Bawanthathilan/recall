import { guessColumns, parseDelimited, parseTable, tableToNotes } from '@/lib/csv';
import { htmlToMarkup } from '@/lib/html';

describe('parseDelimited', () => {
  it('handles quotes, escaped quotes, commas and line breaks inside fields', () => {
    const csv = 'front,back\n"Hello, world","He said ""hi""\nthen left"\r\nplain,row\n\n';
    expect(parseDelimited(csv, ',')).toEqual([
      ['front', 'back'],
      ['Hello, world', 'He said "hi"\nthen left'],
      ['plain', 'row'],
    ]);
  });
});

describe('parseTable', () => {
  it('detects the delimiter and a header row', () => {
    const t = parseTable('Question;Answer\nWhat is 2+2?;4\nCapital of France?;Paris');
    expect(t.delimiter).toBe(';');
    expect(t.header).toEqual(['Question', 'Answer']);
    expect(t.rows).toEqual([
      ['What is 2+2?', '4'],
      ['Capital of France?', 'Paris'],
    ]);
  });

  it('treats the first row as data when it doesn’t look like a header', () => {
    const t = parseTable('hola\thello\nadiós\tgoodbye\n');
    expect(t.delimiter).toBe('\t');
    expect(t.header).toBeNull();
    expect(t.rows).toHaveLength(2);
  });

  it('reads Anki’s plain-text export header lines', () => {
    const t = parseTable('#separator:tab\n#html:true\n#columns:Front\tBack\tTags\ncat\t<b>gato</b>\tspanish animals\n');
    expect(t).toMatchObject({ delimiter: '\t', html: true, header: ['Front', 'Back', 'Tags'] });
    expect(t.rows).toEqual([['cat', '<b>gato</b>', 'spanish animals']]);
    expect(guessColumns(t)).toEqual({ front: 0, back: 1, tags: 2 });
  });

  it('strips the byte-order mark Excel adds', () => {
    expect(parseTable('﻿Term,Definition\na,b').header).toEqual(['Term', 'Definition']);
  });
});

describe('htmlToMarkup', () => {
  it('converts formatting Recall can show', () => {
    expect(htmlToMarkup('<div>What does <b>map</b> return?</div><div>Use <code>arr.map(fn)</code></div>').text).toBe(
      'What does **map** return?\nUse `arr.map(fn)`',
    );
    expect(htmlToMarkup('one<br>two<br/><br />three').text).toBe('one\ntwo\n\nthree');
    expect(htmlToMarkup('<ul><li>a</li><li>b</li></ul>').text).toBe('• a\n• b');
  });

  it('keeps code blocks exact and decodes entities', () => {
    expect(htmlToMarkup('<pre><code>if (a &lt; b &amp;&amp; c) {\n  go();\n}</code></pre>').text).toBe('```\nif (a < b && c) {\n  go();\n}\n```');
    expect(htmlToMarkup('<div>Output?</div><pre>a\nb</pre><div>Why?</div>').text).toBe('Output?\n```\na\nb\n```\nWhy?');
    expect(htmlToMarkup('caf&eacute;&nbsp;&#8594; &#x41;').text).toBe('caf&eacute; → A');
  });

  it('drops images and audio but reports them', () => {
    expect(htmlToMarkup('犬 <img src="dog.jpg"> [sound:inu.mp3]')).toEqual({ text: '犬', hadMedia: true });
    expect(htmlToMarkup('<span style="color:red">plain</span>')).toEqual({ text: 'plain', hadMedia: false });
  });

  it('leaves Anki clozes alone', () => {
    expect(htmlToMarkup('The {{c1::<b>mitochondria</b>::organelle}} makes ATP').text).toBe('The {{c1::**mitochondria**::organelle}} makes ATP');
  });
});

describe('tableToNotes', () => {
  it('makes basic notes, spots clozes, reads tags and skips half-empty rows', () => {
    const table = parseTable('Front,Back,Tags\ncat,gato,animals\n"The {{c1::heart}} pumps blood",,\nlonely,,');
    const { notes, skipped } = tableToNotes(table, { ...guessColumns(table), reverse: true });
    expect(skipped).toBe(1);
    expect(notes.map((n) => n.note)).toEqual([
      { type: 'basic', fields: { front: 'cat', back: 'gato', reverse: true } },
      { type: 'cloze', fields: { text: 'The {{c1::heart}} pumps blood', extra: '' } },
    ]);
    expect(notes[0].tags).toEqual(['animals']);
  });
});
