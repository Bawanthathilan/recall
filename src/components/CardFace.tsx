import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { CodeBlock } from '@/components/CodeBlock';
import { Markup } from '@/components/Markup';
import type { StudyCard } from '@/db/queries';
import { NOTE_TYPE_LABEL, parseNote, type NoteData, type Typed, type VocabFields } from '@/lib/notes';
import { t } from '@/i18n';
import { colors, fonts, lineHeight, ratingColors, spacing, tones, type } from '@/theme';

/** Chip in the card's top-left, as in the mockup: "Closures · Scope", "Vocabulary · Verb". */
export function cardChip(note: NoteData, tags: string): { label: string; fg: string; bg: string } {
  const tone = { basic: { fg: colors.muted, bg: colors.track }, cloze: tones.green, code: tones.blue, vocab: tones.orange }[note.type];
  if (note.type === 'vocab') return { label: [NOTE_TYPE_LABEL.vocab, note.fields.pos].filter(Boolean).join(' · '), ...tone };
  const tagList = tags.split(' ').filter(Boolean).slice(0, 2);
  const label = tagList.length ? tagList.map((t) => t[0].toUpperCase() + t.slice(1)).join(' · ') : NOTE_TYPE_LABEL[note.type];
  return { label, ...tone };
}

/** Does this card ask you to type the answer (instead of just "Show answer")? */
export function wantsTypedAnswer(card: StudyCard) {
  return card.note_type === 'vocab' && card.ord === 0;
}

/** What you're asked. */
export function CardQuestion({ card }: { card: StudyCard }) {
  const note = parseNote(card.note_type, card.fields);
  switch (note.type) {
    case 'basic':
      return <Markup text={card.ord === 1 ? note.fields.back : note.fields.front} style={type.cardTitle} />;
    case 'cloze':
      return <Markup text={note.fields.text} style={styles.clozeText} cloze={{ ord: card.ord, revealed: false }} />;
    case 'code':
      return (
        <>
          <Markup text={note.fields.prompt} style={type.cardTitle} />
          <CodeBlock code={note.fields.code} language={note.fields.language} showLanguage />
        </>
      );
    case 'vocab':
      return card.ord === 1 ? (
        <View style={styles.centered}>
          <Text style={styles.meaningBig}>{note.fields.meaning}</Text>
          <Text style={type.caption}>{t('cardFace.whatsTheWord')}</Text>
        </View>
      ) : (
        <>
          <VocabWord fields={note.fields} />
          {!!note.fields.example && <Example text={note.fields.example} />}
        </>
      );
  }
}

/** The revealed side. `typed` is set when you typed an answer before revealing. */
export function CardAnswer({ card, typed }: { card: StudyCard; typed?: Typed | null }) {
  const note = parseNote(card.note_type, card.fields);
  switch (note.type) {
    case 'basic':
      return (
        <>
          <Markup text={card.ord === 1 ? note.fields.back : note.fields.front} style={styles.questionSmall} codeVariant="light" />
          <Divider />
          <AnswerLabel />
          <Markup text={card.ord === 1 ? note.fields.front : note.fields.back} style={styles.answer} />
        </>
      );
    case 'cloze':
      return (
        <>
          <Markup text={note.fields.text} style={styles.clozeText} cloze={{ ord: card.ord, revealed: true }} />
          {!!note.fields.extra && (
            <>
              <Divider />
              <Markup text={note.fields.extra} style={styles.answer} />
            </>
          )}
        </>
      );
    case 'code':
      return (
        <>
          <Markup text={note.fields.prompt} style={styles.questionSmall} />
          <CodeBlock code={note.fields.code} language={note.fields.language} variant="light" />
          <Divider />
          <AnswerLabel />
          <Text style={styles.codeAnswer}>{note.fields.answer}</Text>
          {!!note.fields.explanation && <Markup text={note.fields.explanation} style={styles.answer} />}
        </>
      );
    case 'vocab':
      return card.ord === 1 ? (
        <>
          <Text style={styles.questionSmall}>{note.fields.meaning}</Text>
          <Divider />
          <AnswerLabel />
          <VocabWord fields={note.fields} />
          {!!note.fields.example && <Example text={note.fields.example} />}
        </>
      ) : (
        <>
          <VocabWord fields={note.fields} compact />
          <Divider />
          {typed && <TypedResult typed={typed} />}
          <AnswerLabel />
          <Text style={styles.meaning}>{note.fields.meaning}</Text>
          {!!note.fields.example && <Example text={note.fields.example} />}
        </>
      );
  }
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function VocabWord({ fields, compact }: { fields: VocabFields; compact?: boolean }) {
  return (
    <View style={[styles.centered, compact && { gap: 2 }]}>
      {!!fields.reading && fields.reading !== fields.word && <Text style={styles.reading}>{fields.reading}</Text>}
      {/* No custom fontFamily: the system font has CJK and other scripts that our fonts lack. */}
      <Text style={[styles.word, compact && styles.wordCompact]}>{fields.word}</Text>
      {!!fields.transliteration && <Text style={type.caption}>{fields.transliteration}</Text>}
    </View>
  );
}

function Example({ text }: { text: string }) {
  return (
    <View style={styles.example}>
      <Text style={type.label}>{t('cardFace.example')}</Text>
      <Text style={styles.exampleText}>{text}</Text>
    </View>
  );
}

function TypedResult({ typed }: { typed: Typed }) {
  const c = typed.correct ? { fg: colors.success, bg: tones.green.bg } : ratingColors.again;
  return (
    <View style={[styles.typed, { backgroundColor: c.bg }]} accessibilityLiveRegion="polite">
      <Ionicons name={typed.correct ? 'checkmark-circle' : 'close-circle'} size={20} color={c.fg} />
      <Text style={[styles.typedText, { color: c.fg }]}>{typed.correct ? t('cardFace.correct') : t('cardFace.youTyped', { value: typed.value })}</Text>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;
const AnswerLabel = () => <Text style={[type.label, { color: colors.success }]}>{t('cardFace.answer')}</Text>;

const styles = StyleSheet.create({
  questionSmall: { fontFamily: fonts.body, fontSize: 15, lineHeight: lineHeight(15, 21), color: colors.muted },
  answer: { fontFamily: fonts.body, fontSize: 16, lineHeight: lineHeight(16, 24), color: colors.bodySoft },
  clozeText: { fontFamily: fonts.body, fontSize: 21, lineHeight: lineHeight(21, 31), color: colors.ink },
  codeAnswer: { fontFamily: fonts.monoMedium, fontSize: 26, lineHeight: 34, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  centered: { alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  reading: { fontSize: 18, letterSpacing: 4, color: colors.muted },
  word: { fontSize: 64, lineHeight: 72, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  wordCompact: { fontSize: 40, lineHeight: 48 },
  meaningBig: { ...type.cardTitle, textAlign: 'center' },
  meaning: { fontFamily: fonts.bodySemi, fontSize: 22, lineHeight: lineHeight(22, 28), color: colors.ink },
  example: { alignSelf: 'stretch', padding: 14, borderRadius: 14, backgroundColor: colors.ground, gap: 4 },
  exampleText: { fontSize: 16, lineHeight: lineHeight(16, 24), color: colors.ink },
  typed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12 },
  typedText: { fontFamily: fonts.bodySemi, fontSize: 15, flexShrink: 1 },
});
