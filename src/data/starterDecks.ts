/**
 * Starter decks offered on the Explore tab, bundled with the app (no download).
 * Each is tagged with the onboarding goals it suits, so Explore can show
 * "For you" first. Adding one copies its notes into a new deck.
 */
import type { NoteData, VocabFields } from '@/lib/notes';
import type { Goal } from '@/store/settings';
import type { Tone } from '@/theme';

export type StarterNote = { note: NoteData; tags?: string[] };
export type StarterDeck = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tone: Tone;
  goals: Goal[];
  notes: StarterNote[];
};

const basic = (front: string, back: string, reverse = false, tags?: string[]): StarterNote => ({
  note: { type: 'basic', fields: { front, back, reverse } },
  tags,
});
const cloze = (text: string, extra = '', tags?: string[]): StarterNote => ({ note: { type: 'cloze', fields: { text, extra } }, tags });
const vocab = (v: Partial<VocabFields> & Pick<VocabFields, 'word' | 'meaning'>, tags?: string[]): StarterNote => ({
  note: { type: 'vocab', fields: { reading: '', transliteration: '', pos: '', example: '', reverse: false, ...v } },
  tags,
});

// ─── Programming ────────────────────────────────────────────────────────────

const GIT: StarterNote[] = [
  basic('How do you create a new branch and switch to it?', '`git switch -c <name>` (older: `git checkout -b <name>`)'),
  basic('What does `git fetch` do?', 'Downloads new commits and branches from the remote without changing your files or your current branch.'),
  basic('`git pull` is shorthand for which two steps?', '`git fetch`, then merging (or rebasing) the fetched branch into your current branch.'),
  basic('How do you stage only some of the changes in a file?', '`git add -p` — it walks through each change and asks whether to stage it.'),
  basic('How do you undo the last commit but keep its changes?', '`git reset --soft HEAD~1` — the changes stay staged.'),
  basic('How do you throw away uncommitted changes to one file?', '`git restore <file>` (older: `git checkout -- <file>`)'),
  basic('What does `git stash` do?', 'Puts your uncommitted changes aside and cleans the working tree. `git stash pop` brings them back.'),
  basic('How do you change the message of the last commit?', '`git commit --amend`'),
  basic('How do you see who last changed each line of a file?', '`git blame <file>`'),
  basic('What does `git revert <commit>` do?', 'Adds a new commit that undoes that commit’s changes. History isn’t rewritten, so it’s safe on shared branches.'),
  basic('Rebase vs merge?', 'Rebase replays your commits on top of another branch (linear history, new commit IDs). Merge joins the two histories with a merge commit.'),
  basic('Which command finds the commit that introduced a bug?', '`git bisect` — a binary search through history: you mark commits good or bad.'),
  basic('How do you show a compact history with branch lines?', '`git log --oneline --graph`'),
  basic('What is `HEAD`?', 'A pointer to the commit you have checked out — usually via your current branch.'),
  basic('How do you delete a local branch that has been merged?', '`git branch -d <name>` (`-D` forces it even if unmerged)'),
];

const BIG_O: StarterNote[] = [
  basic('Reading an array element by index', '**O(1)**'),
  basic('Looking up a key in a hash map', '**O(1)** on average, O(n) in the worst case (many collisions).'),
  basic('Binary search', '**O(log n)** — the list must be sorted.'),
  basic('Merge sort: time and extra space', '**O(n log n)** time in every case, **O(n)** extra space.'),
  basic('Quicksort: worst case', '**O(n²)**, e.g. always picking the smallest element as pivot. Average O(n log n).'),
  basic('Inserting at the start of an array', '**O(n)** — every element shifts one place.'),
  basic('Push and pop on a stack', '**O(1)**'),
  basic('Search in a balanced binary search tree', '**O(log n)**'),
  basic('Breadth-first search on a graph', '**O(V + E)** — every vertex and edge once.'),
  basic('Two nested loops over the same n items', '**O(n²)**'),
  basic('Insert into a binary heap', '**O(log n)**; reading the min (or max) is O(1).'),
  cloze('Appending to a dynamic array is {{c1::O(1)}} amortised, because the array {{c2::doubles its capacity}} when it fills up.'),
];

const SQL: StarterNote[] = [
  basic('`WHERE` vs `HAVING`?', '`WHERE` filters rows before grouping. `HAVING` filters groups after `GROUP BY`, so it can use `COUNT(*)`, `SUM()`…'),
  basic('`INNER JOIN` vs `LEFT JOIN`?', '`INNER JOIN` keeps only rows with a match in both tables. `LEFT JOIN` keeps every row from the left table, with `NULL`s where there’s no match.'),
  basic('`COUNT(*)` vs `COUNT(column)`?', '`COUNT(*)` counts rows. `COUNT(column)` skips rows where that column is `NULL`.'),
  basic('Why doesn’t `WHERE x = NULL` find anything?', 'Any comparison with `NULL` is unknown, never true. Use `x IS NULL`.'),
  basic('`UNION` vs `UNION ALL`?', '`UNION` removes duplicate rows; `UNION ALL` keeps them all (and is faster).'),
  basic('What does an index trade off?', 'Faster lookups and sorting on its columns, for slower inserts/updates and extra storage.'),
  cloze('Clauses run in this order: {{c1::FROM}} → {{c2::WHERE}} → GROUP BY → {{c3::HAVING}} → SELECT → ORDER BY → LIMIT.', 'That’s why a column alias from SELECT can’t be used in WHERE.'),
  {
    note: {
      type: 'code',
      fields: {
        prompt: 'What does this query return?',
        language: 'sql',
        code: 'SELECT department, COUNT(*)\nFROM employees\nGROUP BY department\nHAVING COUNT(*) > 5;',
        answer: 'Each department with more than 5 employees, and its headcount.',
        explanation: '`GROUP BY` makes one row per department; `HAVING` then drops groups of 5 or fewer.',
      },
    },
  },
];

// ─── Languages ──────────────────────────────────────────────────────────────

const SPANISH: StarterNote[] = (
  [
    ['hola', 'Interjection', 'hello, hi', '¡Hola! ¿Qué tal?'],
    ['gracias', 'Interjection', 'thank you, thanks', 'Muchas gracias por tu ayuda.'],
    ['por favor', 'Phrase', 'please', 'Un café, por favor.'],
    ['el agua', 'Noun', 'water', 'Quiero un vaso de agua.'],
    ['la casa', 'Noun', 'house, home', 'Mi casa es pequeña.'],
    ['el perro', 'Noun', 'dog', 'El perro duerme en el sofá.'],
    ['el gato', 'Noun', 'cat', 'Tengo un gato negro.'],
    ['el libro', 'Noun', 'book', 'Estoy leyendo un libro.'],
    ['la ciudad', 'Noun', 'city', 'Madrid es una ciudad grande.'],
    ['el trabajo', 'Noun', 'work, job', 'Voy al trabajo en autobús.'],
    ['el amigo', 'Noun', 'friend', 'Es mi mejor amigo.'],
    ['la familia', 'Noun', 'family', 'Mi familia vive en Lima.'],
    ['el tiempo', 'Noun', 'time, weather', 'No tengo tiempo hoy.'],
    ['comer', 'Verb', 'to eat', 'Vamos a comer a las dos.'],
    ['beber', 'Verb', 'to drink', 'Bebo café cada mañana.'],
    ['hablar', 'Verb', 'to speak, to talk', '¿Hablas inglés?'],
    ['tener', 'Verb', 'to have', 'Tengo dos hermanos.'],
    ['ser', 'Verb · identity, traits', 'to be', 'Soy estudiante.'],
    ['estar', 'Verb · states, location', 'to be', 'Estoy cansado.'],
    ['ir', 'Verb', 'to go', 'Mañana voy a la playa.'],
    ['querer', 'Verb', 'to want, to love', 'Quiero aprender español.'],
    ['grande', 'Adjective', 'big, large', 'Es una casa grande.'],
    ['pequeño', 'Adjective', 'small, little', 'El gato es pequeño.'],
    ['nuevo', 'Adjective', 'new', 'Tengo un teléfono nuevo.'],
    ['feliz', 'Adjective', 'happy', 'Estoy muy feliz.'],
    ['hoy', 'Adverb', 'today', 'Hoy hace sol.'],
    ['mañana', 'Adverb', 'tomorrow', 'Nos vemos mañana.'],
    ['ayer', 'Adverb', 'yesterday', 'Ayer fui al cine.'],
    ['siempre', 'Adverb', 'always', 'Siempre llega tarde.'],
    ['nunca', 'Adverb', 'never', 'Nunca como carne.'],
    ['¿dónde?', 'Question', 'where', '¿Dónde está el baño?'],
    ['¿cuándo?', 'Question', 'when', '¿Cuándo empieza la clase?'],
  ] as const
).map(([word, pos, meaning, example]) => vocab({ word, pos, meaning, example, reverse: true }));

// Gojūon order. Meanings list accepted spellings: "shi, si" means either is right when typed.
const HIRAGANA: StarterNote[] = (
  [
    ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
    ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
    ['さ', 'sa'], ['し', 'shi, si'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
    ['た', 'ta'], ['ち', 'chi, ti'], ['つ', 'tsu, tu'], ['て', 'te'], ['と', 'to'],
    ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
    ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu, hu'], ['へ', 'he'], ['ほ', 'ho'],
    ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
    ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
    ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
    ['わ', 'wa'], ['を', 'wo, o'], ['ん', 'n'],
  ] as const
).map(([word, meaning]) => vocab({ word, meaning, pos: 'Hiragana' }));

// ─── University ─────────────────────────────────────────────────────────────

const CELLS: StarterNote[] = [
  cloze('The {{c1::mitochondria}} make most of a cell’s {{c2::ATP}} through cellular respiration.'),
  cloze('{{c1::Ribosomes}} build proteins by translating {{c2::mRNA}}.'),
  cloze('In eukaryotes, DNA is transcribed into mRNA in the {{c1::nucleus}}.'),
  cloze('The cell membrane is a {{c1::phospholipid bilayer}}.'),
  cloze('Plant cells have a {{c1::cell wall}} made of {{c2::cellulose}}, and {{c3::chloroplasts}} for photosynthesis.'),
  basic('What does the Golgi apparatus do?', 'Modifies, sorts and packages proteins and lipids, then ships them to where they’re needed or out of the cell.'),
  basic('Rough vs smooth endoplasmic reticulum?', 'Rough ER is studded with ribosomes and makes proteins. Smooth ER makes lipids and helps detoxify.'),
  basic('What do lysosomes do?', 'Break down waste, worn-out organelles and pathogens with digestive enzymes.'),
  basic('Prokaryotic vs eukaryotic cells?', 'Prokaryotes (bacteria, archaea) have no nucleus or membrane-bound organelles. Eukaryotes have both.'),
  basic('What does mitosis produce?', 'Two genetically identical daughter cells with the same chromosome number as the parent.'),
  basic('What does meiosis produce?', 'Four genetically different cells with half the chromosome number (gametes).'),
  basic('The phases of mitosis, in order?', 'Prophase, metaphase, anaphase, telophase — then cytokinesis splits the cell.'),
  basic('What is osmosis?', 'Movement of water across a partially permeable membrane, towards the side with more dissolved solute.'),
  basic('How do DNA bases pair?', 'A with T, C with G. In RNA, U takes the place of T.'),
];

const DERIVATIVES: StarterNote[] = [
  basic('d/dx xⁿ', 'n·xⁿ⁻¹ (the power rule)'),
  basic('d/dx of a constant', '0'),
  basic('d/dx √x', '1 / (2√x)'),
  basic('d/dx sin x', 'cos x'),
  basic('d/dx cos x', '−sin x'),
  basic('d/dx tan x', 'sec² x'),
  basic('d/dx eˣ', 'eˣ'),
  basic('d/dx aˣ', 'aˣ · ln a'),
  basic('d/dx ln x', '1/x'),
  basic('Product rule: (f·g)′', 'f′·g + f·g′'),
  basic('Quotient rule: (f/g)′', '(f′·g − f·g′) / g²'),
  basic('Chain rule: d/dx f(g(x))', 'f′(g(x)) · g′(x)'),
  basic('What does a derivative tell you?', 'The instantaneous rate of change — the slope of the tangent line at that point.'),
];

const STATISTICS: StarterNote[] = [
  basic('Mean vs median: which resists outliers?', 'The **median**. One huge value drags the mean but barely moves the median.'),
  basic('What is the mode?', 'The most frequent value.'),
  basic('What does the standard deviation measure?', 'How spread out values are around the mean. It’s the square root of the variance.'),
  basic('The 68–95–99.7 rule', 'In a normal distribution about 68% of values lie within 1 SD of the mean, 95% within 2, and 99.7% within 3.'),
  basic('What is a p-value?', 'The probability of results at least this extreme if the null hypothesis were true.'),
  basic('Type I vs Type II error?', 'Type I: rejecting a true null hypothesis (false positive). Type II: failing to reject a false one (false negative).'),
  basic('What does a 95% confidence interval mean?', 'If you repeated the study many times, about 95% of the intervals built this way would contain the true value.'),
  basic('Standard error of the mean', 'SD / √n — how much the sample mean varies from sample to sample.'),
  basic('What is the interquartile range?', 'Q3 − Q1: the spread of the middle 50% of the data.'),
  basic('Does correlation imply causation?', 'No. A third factor may drive both, or the direction may be reversed.'),
  basic('Population vs sample?', 'The population is everyone you care about; a sample is the subset you actually measure.'),
];

// ─── Medicine ───────────────────────────────────────────────────────────────

const MED_TERMS: StarterNote[] = (
  [
    ['cardi/o', 'heart'], ['hepat/o', 'liver'], ['nephr/o, ren/o', 'kidney'], ['gastr/o', 'stomach'],
    ['derm/o, dermat/o', 'skin'], ['oste/o', 'bone'], ['arthr/o', 'joint'], ['my/o', 'muscle'],
    ['neur/o', 'nerve'], ['encephal/o', 'brain'], ['pneum/o, pulmon/o', 'lung'], ['hem/o, hemat/o', 'blood'],
    ['rhin/o', 'nose'], ['ot/o', 'ear'], ['ophthalm/o', 'eye'],
    ['-itis', 'inflammation'], ['-ectomy', 'surgical removal'], ['-otomy', 'cutting into (incision)'],
    ['-ostomy', 'surgically creating an opening'], ['-plasty', 'surgical repair'], ['-scopy', 'looking inside with an instrument'],
    ['-algia', 'pain'], ['-emia', 'blood condition'], ['-megaly', 'enlargement'], ['-penia', 'deficiency, too few'],
    ['-logy', 'study of'],
    ['brady-', 'slow'], ['tachy-', 'fast'], ['hyper-', 'above, excessive'], ['hypo-', 'below, deficient'],
    ['dys-', 'difficult, abnormal'], ['a-, an-', 'without, absence of'], ['peri-', 'around'], ['endo-', 'within'],
  ] as const
).map(([part, meaning]) => basic(part, meaning));

const BONES: StarterNote[] = [
  basic('How many bones are in the adult human body?', '206'),
  basic('The longest bone in the body', 'Femur (thigh bone)'),
  basic('The smallest bone in the body', 'Stapes, in the middle ear'),
  basic('Collarbone', 'Clavicle', true),
  basic('Shoulder blade', 'Scapula', true),
  basic('Kneecap', 'Patella', true),
  basic('Breastbone', 'Sternum', true),
  basic('Heel bone', 'Calcaneus', true),
  basic('Bone of the upper arm', 'Humerus'),
  basic('Bones of the forearm', 'Radius (thumb side) and ulna'),
  basic('Bones of the lower leg', 'Tibia (shin, the larger one) and fibula'),
  basic('The only movable bone of the skull', 'Mandible (lower jaw)'),
  basic('How many pairs of ribs?', '12'),
  cloze('The spine has {{c1::7}} cervical, {{c2::12}} thoracic and {{c3::5}} lumbar vertebrae, then the sacrum and coccyx.'),
  basic('Wrist bones', 'Carpals (8 in each wrist)'),
];

// ─── General knowledge ──────────────────────────────────────────────────────

const CAPITALS: StarterNote[] = (
  [
    ['Japan', 'Tokyo'], ['France', 'Paris'], ['Australia', 'Canberra'], ['Canada', 'Ottawa'],
    ['Brazil', 'Brasília'], ['Turkey', 'Ankara'], ['Egypt', 'Cairo'], ['India', 'New Delhi'],
    ['China', 'Beijing'], ['Germany', 'Berlin'], ['Italy', 'Rome'], ['Spain', 'Madrid'],
    ['Mexico', 'Mexico City'], ['Argentina', 'Buenos Aires'], ['Kenya', 'Nairobi'], ['Nigeria', 'Abuja'],
    ['South Korea', 'Seoul'], ['Thailand', 'Bangkok'], ['Vietnam', 'Hanoi'], ['New Zealand', 'Wellington'],
    ['Switzerland', 'Bern'], ['Russia', 'Moscow'], ['United Kingdom', 'London'], ['United States', 'Washington, D.C.'],
    ['Pakistan', 'Islamabad'], ['Bangladesh', 'Dhaka'], ['Peru', 'Lima'], ['Chile', 'Santiago'],
    ['Portugal', 'Lisbon'], ['Norway', 'Oslo'], ['Morocco', 'Rabat'], ['Ethiopia', 'Addis Ababa'],
    ['Myanmar', 'Naypyidaw'],
    ['Sri Lanka', 'Sri Jayawardenepura Kotte (Colombo is the commercial capital)'],
    ['Netherlands', 'Amsterdam (the government sits in The Hague)'],
    ['South Africa', 'Pretoria (executive), Cape Town (legislative), Bloemfontein (judicial)'],
  ] as const
).map(([country, capital]) => basic(`Capital of ${country}?`, capital));

const ELEMENTS: StarterNote[] = (
  [
    ['H', 'Hydrogen'], ['He', 'Helium'], ['Li', 'Lithium'], ['Be', 'Beryllium'], ['B', 'Boron'],
    ['C', 'Carbon'], ['N', 'Nitrogen'], ['O', 'Oxygen'], ['F', 'Fluorine'], ['Ne', 'Neon'],
    ['Na', 'Sodium'], ['Mg', 'Magnesium'], ['Al', 'Aluminium'], ['Si', 'Silicon'], ['P', 'Phosphorus'],
    ['S', 'Sulfur'], ['Cl', 'Chlorine'], ['Ar', 'Argon'], ['K', 'Potassium'], ['Ca', 'Calcium'],
  ] as const
).map(([symbol, name], i) => basic(`**${symbol}**`, `${name} — atomic number ${i + 1}`, true));

export const STARTER_DECKS: StarterDeck[] = [
  { id: 'git', name: 'Git Essentials', description: 'The commands you reach for every day, and what they really do.', icon: 'code-slash', tone: 'blue', goals: ['code'], notes: GIT },
  { id: 'big-o', name: 'Big-O Complexity', description: 'Time and space costs of common operations — interview staples.', icon: 'code-slash', tone: 'green', goals: ['code', 'university'], notes: BIG_O },
  { id: 'sql', name: 'SQL Basics', description: 'Joins, grouping, NULLs and the order clauses really run in.', icon: 'code-slash', tone: 'orange', goals: ['code'], notes: SQL },
  { id: 'spanish', name: 'Spanish: First Words', description: 'Everyday words with example sentences. Practised both ways.', icon: 'language', tone: 'orange', goals: ['language'], notes: SPANISH },
  { id: 'hiragana', name: 'Hiragana', description: 'All 46 basic characters. Type the romaji to answer.', icon: 'language', tone: 'blue', goals: ['language'], notes: HIRAGANA },
  { id: 'cells', name: 'Cell Biology', description: 'Organelles, cell division and the basics of DNA.', icon: 'flask-outline', tone: 'green', goals: ['university', 'medicine', 'exam'], notes: CELLS },
  { id: 'derivatives', name: 'Calculus: Derivatives', description: 'Standard derivatives and the rules for combining them.', icon: 'calculator-outline', tone: 'blue', goals: ['university', 'exam'], notes: DERIVATIVES },
  { id: 'statistics', name: 'Statistics Essentials', description: 'Spread, significance and the ideas exams love to test.', icon: 'calculator-outline', tone: 'orange', goals: ['university', 'exam'], notes: STATISTICS },
  { id: 'med-terms', name: 'Medical Terminology', description: 'Word parts that let you decode most medical terms.', icon: 'medkit-outline', tone: 'orange', goals: ['medicine'], notes: MED_TERMS },
  { id: 'bones', name: 'Bones of the Body', description: 'The major bones and their everyday names.', icon: 'medkit-outline', tone: 'green', goals: ['medicine', 'university'], notes: BONES },
  { id: 'capitals', name: 'World Capitals', description: 'Capital cities of 36 countries on every continent.', icon: 'globe-outline', tone: 'blue', goals: ['other', 'exam'], notes: CAPITALS },
  { id: 'elements', name: 'Periodic Table: 1–20', description: 'Symbols, names and atomic numbers of the first 20 elements.', icon: 'flask-outline', tone: 'green', goals: ['other', 'university'], notes: ELEMENTS },
];
