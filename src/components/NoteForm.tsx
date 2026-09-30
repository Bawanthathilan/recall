import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DeckTile } from '@/components/DeckRow';
import { Checkbox, Chips, Field, SectionLabel, type Tool } from '@/components/FormControls';
import { ModalHeader } from '@/components/ModalHeader';
import { cardsRemovedBy, createNote, deleteNote, getDecks, updateNote, type Deck } from '@/db/queries';
import { confirm } from '@/lib/confirm';
import { LANGUAGES } from '@/lib/highlight';
import { insertCodeBlock, wrapSelection, type Selection } from '@/lib/markup';
import { t } from '@/i18n';
import { goBack } from '@/lib/nav';
import { emptyNote, NOTE_TYPE_LABEL, nextClozeNumber, parseTags, validateNote, type NoteData, type NoteType } from '@/lib/notes';
import { colors, fonts, radius, ratingColors, spacing, touchTarget, type } from '@/theme';

const TYPES: [NoteType, string][] = (['basic', 'cloze', 'code', 'vocab'] as const).map((type) => [type, NOTE_TYPE_LABEL[type]]);

/** Remember the last type you created during this app session. */
let lastNewType: NoteType = 'basic';

/** Trim text fields before saving — except the end-only trim for code, where leading indentation matters. */
function cleaned(note: NoteData): NoteData {
  const fields = Object.fromEntries(
    Object.entries(note.fields).map(([k, v]) => [k, typeof v !== 'string' ? v : k === 'code' ? v.replace(/\s+$/, '') : v.trim()]),
  );
  return { type: note.type, fields } as NoteData;
}

/**
 * The card editor. New note when `noteId` is undefined; otherwise edits it.
 * Used by /card/new (the ＋ button) and /card/[noteId].
 */
export function NoteForm({
  noteId,
  initial,
  initialDeckId,
  initialTags = '',
}: {
  noteId?: number;
  initial?: NoteData;
  initialDeckId?: number;
  initialTags?: string;
}) {
  const db = useSQLiteContext();
  const editing = noteId !== undefined;
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [deckId, setDeckId] = useState<number | null>(initialDeckId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>(initial?.type ?? lastNewType);
  // One draft per type, so switching Basic → Code → Basic brings your text back.
  const [drafts, setDrafts] = useState(() => {
    const d = Object.fromEntries(TYPES.map(([type]) => [type, emptyNote(type)])) as Record<NoteType, NoteData>;
    if (initial) d[initial.type] = initial;
    return d;
  });
  const [tags, setTags] = useState(initialTags);
  const [error, setError] = useState<string | null>(null);
  // Cursor/selection per field, so the toolbar knows what to wrap.
  const [selections, setSelections] = useState<Record<string, Selection>>({});

  useEffect(() => {
    getDecks(db).then((d) => {
      setDecks(d);
      setDeckId((cur) => cur ?? d[0]?.id ?? null);
    });
  }, [db]);

  const note = drafts[noteType];
  const f = note.fields as Record<string, string | boolean>;
  const deck = decks?.find((d) => d.id === deckId);

  const setField = (key: string, value: string | boolean) => {
    setError(null);
    setDrafts((d) => ({ ...d, [noteType]: { ...d[noteType], fields: { ...d[noteType].fields, [key]: value } } as NoteData }));
  };

  /** Props shared by every text field: value, change handler and selection tracking. */
  const bind = (key: string) => ({
    value: String(f[key] ?? ''),
    onChangeText: (v: string) => setField(key, v),
    onSelection: (s: Selection) => setSelections((cur) => ({ ...cur, [key]: s })),
  });

  // Formatting toolbar. Each tool wraps the current selection in that field.
  const apply = (key: string, edit: (value: string, sel: Selection) => { text: string; selection: Selection }) => {
    const value = String(f[key] ?? '');
    const sel = selections[key] ?? { start: value.length, end: value.length };
    const result = edit(value, sel);
    // We don't control the input's real cursor, and it moves when the text changes,
    // so forget the old selection rather than guess. The next cursor event resets it;
    // until then tools act at the end of the text (never inside the cloze just added).
    setSelections(({ [key]: _stale, ...rest }) => rest);
    setField(key, result.text);
  };
  const tools = (key: string, extra: Tool[] = []): Tool[] => [
    { key: 'bold', label: 'B', a11y: t('noteForm.bold'), onPress: () => apply(key, (v, s) => wrapSelection(v, s, '**', '**', 'bold')) },
    { key: 'code', label: '</>', a11y: t('noteForm.codeBlock'), mono: true, onPress: () => apply(key, (v, s) => insertCodeBlock(v, s)) },
    ...extra,
  ];
  const clozeTool = (key: string): Tool => ({
    key: 'cloze',
    label: t('noteForm.clozeButton'),
    a11y: t('noteForm.clozeA11y'),
    onPress: () => apply(key, (v, s) => wrapSelection(v, s, `{{c${nextClozeNumber(v)}::`, '}}', 'answer')),
  });

  async function save() {
    const problem = validateNote(note) ?? (deck ? null : t('noteForm.pickDeck'));
    if (problem || !deck) return setError(problem);
    const data = cleaned(note);
    const tagList = parseTags(tags);
    if (noteId !== undefined) {
      const removed = await cardsRemovedBy(db, noteId, data);
      const what = t('common.cards', { count: removed });
      if (removed && !(await confirm(t('noteForm.removeTitle', { what }), t('noteForm.removeBody', { what, count: removed }), t('noteForm.remove'))))
        return;
      await updateNote(db, noteId, deck.id, data, tagList);
    } else {
      await createNote(db, deck.id, data, tagList);
      lastNewType = noteType;
    }
    goBack();
  }

  async function remove() {
    if (noteId === undefined) return;
    if (!(await confirm(t('noteForm.deleteTitle'), t('noteForm.deleteBody')))) return;
    await deleteNote(db, noteId);
    goBack();
  }

  if (decks && decks.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { gap: spacing.lg }]}>
          <ModalHeader title={t('noteForm.newCard')} onCancel={goBack} />
          <Text style={type.body}>{t('noteForm.needDeck')}</Text>
          <Button title={t('noteForm.createDeck')} onPress={() => router.replace('/deck/new')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <ModalHeader title={editing ? t('study.edit') : t('noteForm.newCard')} onCancel={goBack} onSave={save} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={ratingColors.again.fg} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={{ gap: spacing.sm }}>
            <SectionLabel>{t('noteForm.cardType')}</SectionLabel>
            {editing ? (
              <Text style={type.caption}>{t('noteForm.typeFixed', { type: NOTE_TYPE_LABEL[noteType] })}</Text>
            ) : (
              <Chips
                options={TYPES}
                value={noteType}
                onChange={(t) => {
                  setError(null);
                  setNoteType(t);
                }}
              />
            )}
          </View>

          <View>
            <Pressable
              onPress={() => setPickerOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={t('noteForm.deckA11y', { deck: deck?.name ?? t('common.none') })}
              accessibilityState={{ expanded: pickerOpen }}
              style={styles.deckButton}
            >
              <Text style={styles.deckLabel}>{t('noteForm.deck')}</Text>
              <Text style={styles.deckName} numberOfLines={1}>
                {deck?.name ?? ' '}
              </Text>
              <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.ink} />
            </Pressable>
            {pickerOpen && (
              <View style={styles.picker}>
                {decks?.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      setDeckId(d.id);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: d.id === deckId }}
                    style={styles.pickerRow}
                  >
                    <DeckTile icon={d.icon} tone={d.tone} size={32} />
                    <Text style={[type.bodySemi, { flex: 1 }]} numberOfLines={1}>
                      {d.name}
                    </Text>
                    {d.id === deckId && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {note.type === 'basic' && (
            <>
              <Field label={t('common.front')} placeholder={t('noteForm.frontPlaceholder')} multiline minHeight={76} tools={tools('front')} {...bind('front')} />
              <Field label={t('common.backSide')} placeholder={t('noteForm.answer')} multiline minHeight={120} tools={tools('back')} {...bind('back')} />
              <Checkbox label={t('noteForm.reverse')} checked={!!f.reverse} onChange={(v) => setField('reverse', v)} />
            </>
          )}

          {note.type === 'cloze' && (
            <>
              <Field
                label={t('noteForm.text')}
                placeholder={t('noteForm.textPlaceholder')}
                hint={t('noteForm.textHint')}
                multiline
                minHeight={120}
                tools={tools('text', [clozeTool('text')])}
                {...bind('text')}
              />
              <Field label={t('noteForm.extra')} placeholder={t('noteForm.extraPlaceholder')} multiline minHeight={60} tools={tools('extra')} {...bind('extra')} />
            </>
          )}

          {note.type === 'code' && (
            <>
              <Field label={t('noteForm.prompt')} placeholder={t('noteForm.promptPlaceholder')} multiline {...bind('prompt')} />
              <View style={{ gap: spacing.sm }}>
                <SectionLabel>{t('noteForm.language')}</SectionLabel>
                <Chips options={LANGUAGES} value={String(f.language)} onChange={(l) => setField('language', l)} scroll />
              </View>
              <Field label={t('cardTypes.code')} placeholder={'for (let i = 0; i < 3; i++) {\n  …\n}'} multiline mono minHeight={130} {...bind('code')} />
              <Field label={t('noteForm.answer')} placeholder="3, 3, 3" mono {...bind('answer')} />
              <Field
                label={t('noteForm.explanation')}
                placeholder={t('noteForm.explanationPlaceholder')}
                multiline
                minHeight={90}
                tools={tools('explanation')}
                {...bind('explanation')}
              />
            </>
          )}

          {note.type === 'vocab' && (
            <>
              <Field label={t('noteForm.word')} placeholder="勉強する" {...bind('word')} />
              <Field label={t('noteForm.reading')} placeholder="べんきょうする" {...bind('reading')} />
              <Field label={t('noteForm.transliteration')} placeholder="benkyō suru" autoCapitalize="none" {...bind('transliteration')} />
              <Field label={t('noteForm.pos')} placeholder={t('noteForm.posPlaceholder')} {...bind('pos')} />
              <Field
                label={t('noteForm.meaning')}
                placeholder={t('noteForm.meaningPlaceholder')}
                hint={t('noteForm.meaningHint')}
                autoCapitalize="none"
                {...bind('meaning')}
              />
              <Field label={t('noteForm.example')} placeholder="毎日日本語を勉強します。" multiline {...bind('example')} />
              <Checkbox label={t('noteForm.produce')} checked={!!f.reverse} onChange={(v) => setField('reverse', v)} />
            </>
          )}

          <Field
            label={t('noteForm.tags')}
            placeholder="closures scope"
            hint={t('noteForm.tagsHint')}
            autoCapitalize="none"
            autoCorrect={false}
            value={tags}
            onChangeText={setTags}
          />

          {editing && <Button title={t('noteForm.deleteCard')} variant="danger" onPress={remove} style={{ marginTop: spacing.lg }} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  content: { padding: spacing.xl, paddingTop: spacing.md, gap: 18 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: ratingColors.again.bg,
  },
  errorText: { fontFamily: fonts.bodySemi, fontSize: 14, color: ratingColors.again.fg, flexShrink: 1 },
  deckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  deckLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  deckName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  picker: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
