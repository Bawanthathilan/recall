import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DatePicker } from '@/components/DatePicker';
import { DeckTile } from '@/components/DeckRow';
import { Chips } from '@/components/FormControls';
import { ModalHeader } from '@/components/ModalHeader';
import { createDeck, deleteDeck, setDeckStudyPlan, updateDeck, type Deck } from '@/db/queries';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/nav';
import { dayKey } from '@/lib/stats';
import { useSettings } from '@/store/settings';
import { t } from '@/i18n';
import { formatDate } from '@/i18n/dates';
import { colors, fonts, radius, spacing, tones, touchTarget, type, type Tone } from '@/theme';

const ICONS = [
  'code-slash',
  'flask-outline',
  'language',
  'school-outline',
  'medkit-outline',
  'calculator-outline',
  'globe-outline',
  'book-outline',
  'musical-notes-outline',
  'albums-outline',
] as const;

/** New deck when `deck` is undefined, otherwise rename/restyle/delete it. */
export function DeckForm({ deck, cardCount = 0 }: { deck?: Deck; cardCount?: number }) {
  const db = useSQLiteContext();
  const [name, setName] = useState(deck?.name ?? '');
  const [icon, setIcon] = useState(deck?.icon ?? 'albums-outline');
  const [tone, setTone] = useState<Tone>(deck?.tone ?? 'orange');
  const [examDate, setExamDate] = useState<string | null>(deck?.exam_date ?? null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newPerDay, setNewPerDay] = useState<number | null>(deck?.new_per_day ?? null);
  const [today] = useState(() => dayKey(new Date()));
  const globalPerDay = useSettings((s) => s.newCardsPerDay);
  const canSave = name.trim().length > 0;

  // "default" = no override: the deck follows the global setting in Settings.
  const paceOptions: [string, string][] = [
    ['default', t('deckForm.default', { count: globalPerDay })],
    ...[10, 20, 30, 50].map((n): [string, string] => [String(n), String(n)]),
  ];
  const examLabel = examDate
    ? formatDate(new Date(`${examDate}T00:00`), { weekday: 'short', day: true, month: 'long', year: true })
    : t('deckForm.noExam');

  async function save() {
    if (!canSave) return;
    if (deck) {
      await updateDeck(db, deck.id, name.trim(), icon, tone);
      await setDeckStudyPlan(db, deck.id, examDate, newPerDay);
      goBack();
    } else {
      const id = await createDeck(db, name.trim(), icon, tone);
      await setDeckStudyPlan(db, id, examDate, newPerDay);
      // Swap this modal for the new deck's page, so Back goes where you came from.
      router.replace({ pathname: '/deck/[deckId]', params: { deckId: String(id) } });
    }
  }

  async function remove() {
    if (!deck) return;
    if (!(await confirm(t('deckForm.deleteTitle', { name: deck.name }), t('deckForm.deleteBody', { cards: t('common.cards', { count: cardCount }) }))))
      return;
    await deleteDeck(db, deck.id);
    router.dismissTo('/decks');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ModalHeader title={deck ? t('deckForm.editDeck') : t('common.newDeck')} onCancel={goBack} onSave={save} canSave={canSave} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          <DeckTile icon={icon} tone={tone} size={64} />
        </View>

        <Text style={styles.fieldLabel} nativeID="deck-name">
          {t('deckForm.name')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('deckForm.namePlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabelledBy="deck-name"
          style={styles.input}
          autoFocus={!deck}
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <Text style={styles.fieldLabel}>{t('deckForm.icon')}</Text>
        <View style={styles.grid}>
          {ICONS.map((i) => {
            const on = i === icon;
            return (
              <Pressable
                key={i}
                onPress={() => setIcon(i)}
                accessibilityRole="radio"
                accessibilityLabel={i.replace('-outline', '').replace('-', ' ')}
                accessibilityState={{ selected: on }}
                style={[styles.iconCell, on && styles.iconCellOn]}
              >
                <Ionicons name={i} size={22} color={on ? colors.surface : colors.ink} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>{t('deckForm.colour')}</Text>
        <View style={styles.tones}>
          {(Object.keys(tones) as Tone[]).map((t) => {
            const on = t === tone;
            return (
              <Pressable
                key={t}
                onPress={() => setTone(t)}
                accessibilityRole="radio"
                accessibilityLabel={t}
                accessibilityState={{ selected: on }}
                style={[styles.tone, { backgroundColor: tones[t].bg, borderColor: on ? tones[t].fg : 'transparent' }]}
              >
                <View style={[styles.toneDot, { backgroundColor: tones[t].fg }]} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>{t('deckForm.examDate')}</Text>
        <View style={styles.examRow}>
          <Pressable
            onPress={() => setCalendarOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={t(calendarOpen ? 'deckForm.examA11yClose' : 'deckForm.examA11yOpen', { date: examLabel })}
            accessibilityState={{ expanded: calendarOpen }}
            style={styles.examButton}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.ink} />
            <Text style={[styles.examText, !examDate && { color: colors.muted }]}>{examLabel}</Text>
          </Pressable>
          {examDate && (
            <Pressable
              onPress={() => {
                setExamDate(null);
                setCalendarOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('deckForm.clearExam')}
              style={styles.clear}
            >
              <Text style={styles.clearText}>{t('deckForm.clear')}</Text>
            </Pressable>
          )}
        </View>
        {calendarOpen && (
          <View style={{ marginTop: spacing.sm }}>
            <DatePicker
              value={examDate}
              minKey={today}
              onChange={(key) => {
                setExamDate(key);
                setCalendarOpen(false);
              }}
            />
          </View>
        )}

        <Text style={styles.fieldLabel}>{t('deckForm.newPerDay')}</Text>
        <Chips
          options={paceOptions}
          value={newPerDay == null ? 'default' : String(newPerDay)}
          onChange={(v) => setNewPerDay(v === 'default' ? null : Number(v))}
        />

        {deck && <Button title={t('deckForm.deleteDeck')} variant="danger" onPress={remove} style={{ marginTop: spacing.xxl + spacing.lg }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  content: { padding: spacing.xl },
  preview: { alignItems: 'center', paddingVertical: spacing.md },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, marginTop: spacing.xl, marginBottom: spacing.sm },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconCell: {
    width: touchTarget + 8,
    height: touchTarget + 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconCellOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tones: { flexDirection: 'row', gap: spacing.md },
  tone: {
    width: touchTarget + 8,
    height: touchTarget + 8,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneDot: { width: 16, height: 16, borderRadius: 8 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  examButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  examText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  clear: { minHeight: touchTarget, paddingHorizontal: spacing.md, justifyContent: 'center' },
  clearText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
});
