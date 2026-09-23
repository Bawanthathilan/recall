import { highlight, languageLabel } from '@/lib/highlight';

describe('highlight', () => {
  it('colours keywords, numbers, function calls and comments', () => {
    const runs = highlight('for (var i = 0; i < 3; i++) setTimeout(f); // hi', 'js');
    const roleOf = (text: string) => runs.find((r) => r.text.includes(text))?.role;
    expect(roleOf('for')).toBe('keyword');
    expect(roleOf('3')).toBe('number');
    expect(roleOf('setTimeout')).toBe('fn');
    expect(roleOf('// hi')).toBe('comment');
  });

  it('never loses or reorders characters', () => {
    const code = 'def f(x):\n    return "hi" + str(x)  # done';
    expect(highlight(code, 'python').map((r) => r.text).join('')).toBe(code);
  });

  it('falls back to plain text for unknown languages', () => {
    expect(highlight('whatever', 'klingon')).toEqual([{ text: 'whatever', role: 'plain' }]);
  });
});

describe('languageLabel', () => {
  it('understands common aliases', () => {
    expect(languageLabel('ts')).toBe('TypeScript');
    expect(languageLabel('c++')).toBe('C++');
  });
});
