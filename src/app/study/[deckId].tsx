import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { CardAnswer, cardChip, CardQuestion, wantsTypedAnswer } from '@/components/CardFace';
import { getCardsByIds, getDecks, getStudyQueue, recordReview, setCardFlagged, undoReview } from '@/db/queries';
import { formatInterval, GRADES, previewRatings, Rating, type Grade } from '@/lib/fsrs';
import { goBack } from '@/lib/nav';
import { checkTypedAnswer, parseNote, type Typed } from '@/lib/notes';
import { useSettings } from '@/store/settings';
import { useStudySession } from '@/store/studySession';
import { colors, fonts, radius, ratingColors, spacing, touchTarget, type } from '@/theme';

const RATING_META: Record<Grade, { label: string; colors: { fg: string; bg: string } }> = {
  [Rating.Again]: { label: 'Again', colors: ratingColors.again },
  [Rating.Hard]: { label: 'Hard', colors: ratingColors.hard },
  [Rating.Good]: { label: 'Good', colors: ratingColors.good },
  [Rating.Easy]: { label: 'Easy', colors: ratingColors.easy },
};

export default function Study() {
  const db = useSQLiteContext();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const { queue, revealed, typed, reviewed, history, shownAt, start, reveal, advance, undo, patchCard, refreshCards } = useStudySession();
  const [loading, setLoading] = useState(true);
  const [deckNames, setDeckNames] = useState<Map<number, string>>(new Map());
  const busy = useRef(false); // guards against double-taps while a save is in flight

  useEffect(() => {
    Promise.all([getStudyQueue(db, deckId === 'all' ? null : Number(deckId), newPerDay), getDecks(db)]).then(([cards, decks]) => {
      start(cards);
      setDeckNames(new Map(decks.map((d) => [d.id, d.name])));
      setLoading(false);
    });
  }, [db, deckId, newPerDay, start]);

  // Coming back from the editor: reload the content of every card in this session
  // (an edit can change siblings too, or remove cards entirely).
  useFocusEffect(
    useCallback(() => {
      const { queue: q, history: h } = useStudySession.getState();
      const ids = [...new Set([...q.map((c) => c.id), ...h.map((e) => e.before.id)])];
      if (ids.length) getCardsByIds(db, ids).then(refreshCards);
    }, [db, refreshCards]),
  );

  const card = queue[0];

  // Computed once when the answer is revealed; the same object is saved on tap.
  const preview = useMemo(() => {
    if (!card || !revealed) return null;
    const at = new Date();
    return { at, outcomes: previewRatings(card, at) };
  }, [card, revealed]);

  async function guarded(task: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  }

  const rate = (grade: Grade) =>
    guarded(async () => {
      if (!card || !preview) return;
      const { updated, logId } = await recordReview(db, card, preview.outcomes[grade], Date.now() - shownAt);
      advance(card, updated, logId);
    });

  const undoLast = () =>
    guarded(async () => {
      const last = history.at(-1);
      if (!last) return;
      await undoReview(db, last.before, last.logId);
      undo();
    });

  const toggleFlag = () =>
    guarded(async () => {
      if (!card) return;
      await setCardFlagged(db, card.id, !card.flagged);
      patchCard({ ...card, flagged: card.flagged ? 0 : 1 });
    });

  if (loading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, { padding: spacing.xl }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={34} color={colors.onAccent} />
        </View>
        <Text style={[type.title, { marginTop: spacing.xl }]}>{reviewed ? 'Session complete' : 'Nothing due'}</Text>
        <Text style={[type.body, styles.doneBody]}>
          {reviewed
            ? `${reviewed} review${reviewed === 1 ? '' : 's'} done. FSRS has scheduled each card for the best moment to see it again.`
            : 'There are no cards due here right now.'}
        </Text>
        <Button title="Back to Today" onPress={goBack} style={styles.doneButton} />
        {history.length > 0 && <Button title="Undo last rating" variant="secondary" onPress={undoLast} style={styles.doneButton} />}
      </SafeAreaView>
    );
  }

  const total = reviewed + queue.length;
  const chip = cardChip(parseNote(card.note_type, card.fields), card.tags);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <IconButton icon="close" label="End session" onPress={goBack} bordered />
        <View style={styles.progress}>
          <View style={styles.progressText}>
            <Text style={styles.progressLabel} numberOfLines={1}>
              {deckNames.get(card.deck_id) ?? ''}
            </Text>
            <Text style={styles.progressLabel}>
              {reviewed + 1} / {total}
            </Text>
          </View>
          <ProgressBar value={reviewed / total} track={colors.line} />
        </View>
        {history.length > 0 && <IconButton icon="arrow-undo-outline" label="Undo last rating" onPress={undoLast} bordered />}
      </View>

      <ScrollView style={styles.cardScroll} contentContainerStyle={styles.card}>
        <View style={styles.cardTop}>
          <Text style={[styles.chip, { color: chip.fg, backgroundColor: chip.bg }]}>{chip.label}</Text>
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="create-outline"
              label="Edit card"
              onPress={() => router.push({ pathname: '/card/[noteId]', params: { noteId: String(card.note_id) } })}
            />
            <IconButton
              icon={card.flagged ? 'flag' : 'flag-outline'}
              label={card.flagged ? 'Unflag card' : 'Flag card'}
              onPress={toggleFlag}
              color={card.flagged ? colors.accent : colors.muted}
            />
          </View>
        </View>

        {!revealed ? (
          <>
            <CardQuestion card={card} />
            <View style={{ flex: 1, minHeight: spacing.xl }} />
            {!wantsTypedAnswer(card) && <Text style={styles.hint}>Think it through, then reveal.</Text>}
          </>
        ) : (
          <CardAnswer card={card} typed={typed} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!preview ? (
          wantsTypedAnswer(card) ? (
            // `key` gives each card a fresh, empty input.
            <TypeAnswer key={card.id} expected={meaningOf(card.note_type, card.fields)} onCheck={reveal} />
          ) : (
            <Button title="Show answer" onPress={() => reveal()} style={styles.showAnswer} />
          )
        ) : (
          <>
            <Text style={styles.ask}>How well did you remember?</Text>
            <View style={styles.ratings}>
              {GRADES.map((g) => {
                const meta = RATING_META[g];
                const interval = formatInterval(preview.outcomes[g].card.due, preview.at);
                return (
                  <Pressable
                    key={g}
                    onPress={() => rate(g)}
                    accessibilityRole="button"
                    accessibilityLabel={`${meta.label}, next review in ${interval}`}
                    style={({ pressed }) => [styles.rating, { backgroundColor: meta.colors.bg }, pressed && styles.pressed]}
                  >
                    <Text style={[styles.ratingLabel, { color: meta.colors.fg }]}>{meta.label}</Text>
                    <Text style={[styles.ratingInterval, { color: meta.colors.fg }]}>{interval}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function meaningOf(noteType: string, fields: string) {
  const note = parseNote(noteType, fields);
  return note.type === 'vocab' ? note.fields.meaning : '';
}

/** The mockup's "Type the meaning [Check]" row. Checking reveals the answer with ✓ or ✗. */
function TypeAnswer({ expected, onCheck }: { expected: string; onCheck: (typed?: Typed) => void }) {
  const [value, setValue] = useState('');
  const typedSomething = value.trim().length > 0;
  const check = () => onCheck(typedSomething ? { value: value.trim(), correct: checkTypedAnswer(value, expected) } : undefined);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.typeLabel} nativeID="type-label">
        Type the meaning
      </Text>
      <View style={styles.typeRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="e.g. to eat"
          placeholderTextColor={colors.muted}
          accessibilityLabelledBy="type-label"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={check}
          style={styles.typeInput}
        />
        <Pressable onPress={check} accessibilityRole="button" style={({ pressed }) => [styles.checkButton, pressed && styles.pressed]}>
          <Text style={styles.checkText}>{typedSomething ? 'Check' : 'Show'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  bordered,
  color = colors.ink,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  bordered?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, bordered && styles.iconBordered, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={bordered ? 20 : 21} color={bordered ? colors.ink : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  progress: { flex: 1, gap: 6 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  progressLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted, flexShrink: 1 },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  iconBordered: { borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardScroll: { flex: 1, margin: spacing.xl, marginVertical: 18 },
  card: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: 22,
    gap: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -6, marginRight: -10 },
  chip: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  showAnswer: { minHeight: 58, borderRadius: radius.card },
  ask: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center' },
  ratings: { flexDirection: 'row', gap: spacing.sm },
  rating: { flex: 1, height: 64, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  ratingLabel: { fontFamily: fonts.bodySemi, fontSize: 15 },
  ratingInterval: { fontFamily: fonts.body, fontSize: 12 },
  typeLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  checkButton: { height: 56, paddingHorizontal: spacing.xl, borderRadius: radius.button, backgroundColor: colors.ink, justifyContent: 'center' },
  checkText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.surface },
  doneIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  doneBody: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  doneButton: { marginTop: spacing.md, alignSelf: 'stretch' },
});
