import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Checkbox, Chips, SectionLabel } from '@/components/FormControls';
import { InlineMarkup } from '@/components/Markup';
import { ModalHeader } from '@/components/ModalHeader';
import { readApkg, saveImportedDecks, type ImportSummary } from '@/db/imports';
import { getDecks, type Deck } from '@/db/queries';
import { convertCollection, ImportError, type AnkiCollection, type ImportedDeck } from '@/lib/anki';
import { guessColumns, parseTable, tableToNotes, type ParsedTable } from '@/lib/csv';
import { t } from '@/i18n';
import { pickFile } from '@/lib/files';
import { goBack } from '@/lib/nav';
import { cardOrds, notePreview } from '@/lib/notes';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

/**
 * Import cards from an Anki deck (.apkg) or a spreadsheet (CSV / tab-separated).
 * Steps: choose a file → check what's in it and pick options → import → done.
 * Opened with `?deckId=` from a deck page, spreadsheet rows go into that deck.
 */
type Step =
  | { kind: 'choose' }
  | { kind: 'reading' }
  | { kind: 'anki'; fileName: string; collection: AnkiCollection }
  | { kind: 'csv'; fileName: string; table: ParsedTable }
  | { kind: 'saving' }
  | { kind: 'done'; summary: ImportSummary; into: string };

const countCards = (decks: ImportedDeck[]) => decks.reduce((sum, d) => sum + d.notes.reduce((s, n) => s + cardOrds(n.note).length, 0), 0);
const baseName = (file: string) => file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

export default function Import() {
  const db = useSQLiteContext();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [error, setError] = useState<string | null>(null);

  async function choose(kind: 'anki' | 'csv') {
    setError(null);
    const file = await pickFile(kind === 'anki' ? ['*/*'] : ['text/csv', 'text/comma-separated-values', 'text/tab-separated-values', 'text/plain', '*/*']);
    if (!file) return;
    setStep({ kind: 'reading' });
    // Let "Reading…" appear before the heavy unzip/parse blocks the JavaScript thread.
    await new Promise((r) => setTimeout(r, 50));
    try {
      if (kind === 'anki') {
        if (!/\.(apkg|colpkg)$/i.test(file.name)) throw new ImportError(t('import.notApkg'));
        setStep({ kind: 'anki', fileName: file.name, collection: await readApkg(await file.bytes()) });
      } else {
        const table = parseTable(await file.text());
        if (!table.rows.length) throw new ImportError(t('import.noRows'));
        if (table.rows.every((r) => r.length < 2)) throw new ImportError(t('import.twoColumns'));
        setStep({ kind: 'csv', fileName: file.name, table });
      }
    } catch (e) {
      if (!(e instanceof ImportError)) console.warn('Import failed', e);
      setError(e instanceof ImportError ? e.message : t('import.readFailed'));
      setStep({ kind: 'choose' });
    }
  }

  async function save(decks: ImportedDeck[], intoDeckId: number | undefined, into: string) {
    setStep({ kind: 'saving' });
    try {
      setStep({ kind: 'done', summary: await saveImportedDecks(db, decks, intoDeckId), into });
    } catch (e) {
      console.warn('Saving import failed', e);
      setError(t('import.saveFailed'));
      setStep({ kind: 'choose' });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ModalHeader title={t('common.importCards')} onCancel={goBack} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step.kind === 'choose' && <Choose onChoose={choose} error={error} />}
        {(step.kind === 'reading' || step.kind === 'saving') && (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.ink} />
            <Text style={type.body}>{step.kind === 'reading' ? t('import.reading') : t('import.importing')}</Text>
          </View>
        )}
        {step.kind === 'anki' && <AnkiOptions fileName={step.fileName} collection={step.collection} onImport={(d) => save(d, undefined, t('import.newDecks'))} />}
        {step.kind === 'csv' && (
          <CsvOptions fileName={step.fileName} table={step.table} initialDeckId={deckId ? Number(deckId) : undefined} onImport={save} />
        )}
        {step.kind === 'done' && <Done summary={step.summary} into={step.into} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 1: choose a file ──────────────────────────────────────────────────

function Choose({ onChoose, error }: { onChoose: (kind: 'anki' | 'csv') => void; error: string | null }) {
  return (
    <>
      <Source
        icon="layers-outline"
        title={t('import.anki')}
        detail={t('import.ankiDetail')}
        onPress={() => onChoose('anki')}
      />
      <Source
        icon="grid-outline"
        title={t('import.spreadsheet')}
        detail={t('import.spreadsheetDetail')}
        onPress={() => onChoose('csv')}
      />
      {error && (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Ionicons name="alert-circle-outline" size={20} color={colors.accent} />
          <Text style={[type.body, { flex: 1 }]}>{error}</Text>
        </View>
      )}
      <Text style={type.caption}>{t('import.noMedia')}</Text>
    </>
  );
}

function Source({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.source, pressed && { backgroundColor: colors.ground }]}
    >
      <View style={styles.sourceIcon}>
        <Ionicons name={icon} size={24} color={colors.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodySemi}>{title}</Text>
        <Text style={type.caption}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

// ─── Step 2a: Anki ──────────────────────────────────────────────────────────

function AnkiOptions({ fileName, collection, onImport }: { fileName: string; collection: AnkiCollection; onImport: (decks: ImportedDeck[]) => void }) {
  const [keepProgress, setKeepProgress] = useState(true);
  const result = convertCollection(collection, { keepProgress });
  const cards = countCards(result.decks);
  const reviewed = result.decks.reduce((sum, d) => sum + d.notes.reduce((s, n) => s + n.schedule.size, 0), 0);

  return (
    <>
      <Text style={type.caption}>{fileName}</Text>
      <SectionLabel>{`${t('common.decks', { count: result.decks.length })} · ${t('common.cards', { count: cards })}`}</SectionLabel>
      <View style={styles.list}>
        {result.decks.map((d) => (
          <View key={d.name} style={styles.listRow}>
            <Text style={[type.bodySemi, { flex: 1 }]} numberOfLines={2}>
              {d.name}
            </Text>
            <Text style={type.caption}>{t('common.cards', { count: countCards([d]) })}</Text>
          </View>
        ))}
      </View>

      <Checkbox label={t('import.keepProgress')} checked={keepProgress} onChange={setKeepProgress} />
      <Text style={type.caption}>
        {keepProgress
          ? t('import.keepProgressOn', { cards: t('common.cards', { count: reviewed }) })
          : t('import.keepProgressOff')}
      </Text>

      {(result.skipped > 0 || result.lostMedia > 0) && (
        <View style={styles.note}>
          {result.lostMedia > 0 && <Text style={type.caption}>{t('import.lostMedia', { notes: t('import.notes', { count: result.lostMedia }) })}</Text>}
          {result.skipped > 0 && (
            <Text style={type.caption}>{t('import.skippedNotes', { notes: t('import.notes', { count: result.skipped }) })}</Text>
          )}
        </View>
      )}

      <Button
        title={cards ? t('import.importN', { cards: t('common.cards', { count: cards }) }) : t('import.nothing')}
        disabled={!cards}
        onPress={() => onImport(result.decks)}
      />
    </>
  );
}

// ─── Step 2b: spreadsheet ───────────────────────────────────────────────────

function CsvOptions({
  fileName,
  table,
  initialDeckId,
  onImport,
}: {
  fileName: string;
  table: ParsedTable;
  initialDeckId?: number;
  onImport: (decks: ImportedDeck[], intoDeckId: number | undefined, into: string) => void;
}) {
  const db = useSQLiteContext();
  const guess = guessColumns(table);
  const [front, setFront] = useState(guess.front);
  const [back, setBack] = useState(guess.back);
  const [tags, setTags] = useState<number | null>(guess.tags);
  const [reverse, setReverse] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [target, setTarget] = useState(initialDeckId ? String(initialDeckId) : 'new');
  const [deckName, setDeckName] = useState(baseName(fileName));

  useEffect(() => {
    getDecks(db).then(setDecks);
  }, [db]);

  const width = Math.max(...table.rows.slice(0, 20).map((r) => r.length));
  const columnName = (i: number) => table.header?.[i] || t('import.column', { n: i + 1 });
  const columns: [string, string][] = Array.from({ length: width }, (_, i) => [String(i), columnName(i)]);
  const { notes, skipped } = tableToNotes(table, { front, back, tags, reverse });
  const cards = countCards([{ name: '', notes }]);
  const existing = decks.find((d) => String(d.id) === target);
  const name = existing?.name ?? deckName.trim();

  return (
    <>
      <Text style={type.caption}>{`${fileName} · ${t('import.rows', { count: table.rows.length })}`}</Text>

      <SectionLabel>{t('import.preview')}</SectionLabel>
      <View style={styles.list}>
        {notes.slice(0, 3).map((n, i) => (
          <View key={i} style={styles.listRow}>
            <InlineMarkup text={notePreview(n.note)} style={[type.body, { flex: 1 }]} numberOfLines={2} />
            <Text style={type.caption}>{t(`cardTypes.${n.note.type === 'cloze' ? 'cloze' : 'basic'}`)}</Text>
          </View>
        ))}
        {!notes.length && <Text style={[type.caption, styles.listRow]}>{t('import.noComplete')}</Text>}
      </View>

      {width > 2 && (
        <>
          <SectionLabel>{t('common.front')}</SectionLabel>
          <Chips options={columns} value={String(front)} onChange={(v) => setFront(Number(v))} scroll />
          <SectionLabel>{t('common.backSide')}</SectionLabel>
          <Chips options={columns} value={String(back)} onChange={(v) => setBack(Number(v))} scroll />
          <SectionLabel>{t('common.tags')}</SectionLabel>
          <Chips options={[['none', t('common.none')], ...columns]} value={tags == null ? 'none' : String(tags)} onChange={(v) => setTags(v === 'none' ? null : Number(v))} scroll />
        </>
      )}
      {width === 2 && (
        <Button
          title={t('import.swap')}
          variant="secondary"
          onPress={() => {
            setFront(back);
            setBack(front);
          }}
        />
      )}
      <Checkbox label={t('import.reverse')} checked={reverse} onChange={setReverse} />

      <SectionLabel>{t('import.addTo')}</SectionLabel>
      <Chips options={[['new', t('common.newDeck')], ...decks.map((d): [string, string] => [String(d.id), d.name])]} value={target} onChange={setTarget} scroll />
      {target === 'new' && (
        <TextInput
          value={deckName}
          onChangeText={setDeckName}
          placeholder={t('import.deckName')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('import.newDeckName')}
          style={styles.input}
        />
      )}
      {skipped > 0 && <Text style={type.caption}>{t('import.skippedRows', { rows: t('import.rows', { count: skipped }) })}</Text>}

      <Button
        title={cards ? t('import.importN', { cards: t('common.cards', { count: cards }) }) : t('import.nothing')}
        disabled={!cards || !name}
        onPress={() => onImport([{ name, notes }], existing?.id, name)}
      />
    </>
  );
}

// ─── Step 3: done ───────────────────────────────────────────────────────────

function Done({ summary, into }: { summary: ImportSummary; into: string }) {
  const one = summary.deckIds.length === 1;
  return (
    <View style={styles.done} accessibilityLiveRegion="polite">
      <View style={styles.doneIcon}>
        <Ionicons name="checkmark" size={32} color={colors.onAccent} />
      </View>
      <Text style={[type.section, { textAlign: 'center' }]}>{t('import.imported', { cards: t('common.cards', { count: summary.cards }) })}</Text>
      <Text style={[type.caption, { textAlign: 'center' }]}>{t('import.into', { name: one ? into : t('common.decks', { count: summary.deckIds.length }) })}</Text>
      <View style={{ alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg }}>
        {one && (
          <Button
            title={t('common.openDeck')}
            onPress={() => router.replace({ pathname: '/deck/[deckId]', params: { deckId: String(summary.deckIds[0]) } })}
          />
        )}
        <Button title={t('common.done')} variant={one ? 'secondary' : 'primary'} onPress={goBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.lg },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sourceIcon: { width: touchTarget, height: touchTarget, borderRadius: radius.sm, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  busy: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  list: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  note: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
  },
  done: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
});
