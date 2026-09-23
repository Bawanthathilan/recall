/**
 * Syntax highlighting with Prism. Prism splits code into a tree of tokens
 * (keyword, string, number…); we flatten that into coloured runs of text that
 * a React Native <Text> can draw.
 */
import Prism from 'prismjs';
// Extra languages (javascript, css, markup and clike ship with core).
// Order matters: a language must be loaded after the ones it extends.
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';

/** Languages offered in the editor: [Prism id, label]. */
export const LANGUAGES: [id: string, label: string][] = [
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['sql', 'SQL'],
  ['bash', 'Shell'],
  ['json', 'JSON'],
];

const ALIASES: Record<string, string> = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', kt: 'kotlin' };

export function languageId(lang: string) {
  const l = lang.trim().toLowerCase();
  return ALIASES[l] ?? l;
}

export function languageLabel(lang: string) {
  const id = languageId(lang);
  return LANGUAGES.find(([l]) => l === id)?.[1] ?? (lang || 'Code');
}

/** Colour roles, mapped to theme.codeColors by the CodeBlock component. */
export type TokenRole = 'plain' | 'keyword' | 'string' | 'number' | 'fn' | 'comment';

const ROLE: Record<string, TokenRole> = {
  keyword: 'keyword',
  builtin: 'keyword',
  boolean: 'number',
  number: 'number',
  string: 'string',
  char: 'string',
  'template-string': 'string',
  regex: 'string',
  function: 'fn',
  'class-name': 'fn',
  comment: 'comment',
  prolog: 'comment',
};

export type CodeRun = { text: string; role: TokenRole };

/** Flatten Prism's token tree into coloured runs. Unknown languages come back as plain text. */
export function highlight(code: string, lang: string): CodeRun[] {
  const grammar = Prism.languages[languageId(lang)];
  if (!grammar) return [{ text: code, role: 'plain' }];

  const runs: CodeRun[] = [];
  const walk = (token: string | Prism.Token | (string | Prism.Token)[], inherited: TokenRole) => {
    if (typeof token === 'string') {
      const prev = runs[runs.length - 1];
      if (prev && prev.role === inherited) prev.text += token; // merge neighbours: fewer <Text> nodes
      else runs.push({ text: token, role: inherited });
    } else if (Array.isArray(token)) {
      token.forEach((t) => walk(t, inherited));
    } else {
      walk(token.content, ROLE[token.type] ?? inherited);
    }
  };
  walk(Prism.tokenize(code, grammar), 'plain');
  return runs;
}
