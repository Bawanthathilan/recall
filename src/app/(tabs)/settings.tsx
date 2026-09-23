import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chips } from '@/components/FormControls';
import { resetAllProgress } from '@/db/queries';
import { seedSampleDecks } from '@/db/seed';
import { confirm } from '@/lib/confirm';
import { enableReminders, remindersSupported, sendTestReminder } from '@/lib/notifications';
import { formatTime } from '@/lib/reminders';
import { useSettings, type Goal } from '@/store/settings';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

const GOAL_NAMES: Record<Goal, string> = {
  code: 'Programming',
  university: 'University',
  language: 'Languages',
  exam: 'Exam prep',
  medicine: 'Medicine',
  other: 'Something else',
};

const PACES = [10, 20, 30, 50];

/** Quick picks for the reminder time, as [hour, minute]. */
const PRESETS: [number, number][] = [
  [8, 0],
  [12, 30],
  [19, 0],
  [21, 30],
];

export default function Settings() {
  const db = useSQLiteContext();
  const { goals, name, newCardsPerDay, reminderEnabled, reminderHour, reminderMinute, update, resetOnboarding } = useSettings();
  const [draftName, setDraftName] = useState(name);
  const [resetDone, setResetDone] = useState(false);
  const [samplesAdded, setSamplesAdded] = useState(false);
  const [denied, setDenied] = useState(false);
  const [testSent, setTestSent] = useState(false);

  async function toggleReminder(on: boolean) {
    if (!on) return update({ reminderEnabled: false });
    const result = await enableReminders(); // asks for permission the first time
    setDenied(result === 'denied');
    if (result === 'granted') update({ reminderEnabled: true });
  }

  /** Move the reminder by `delta` minutes, wrapping around midnight. */
  const shiftTime = (delta: number) => {
    const total = (reminderHour * 60 + reminderMinute + delta + 1440) % 1440;
    update({ reminderHour: Math.floor(total / 60), reminderMinute: total % 60 });
  };
  const timeKey = `${reminderHour}:${reminderMinute}`;

  async function reset() {
    if (!(await confirm('Reset study progress?', 'Every card becomes new again and your review history is deleted.', 'Reset'))) return;
    await resetAllProgress(db);
    setResetDone(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={type.label} nativeID="name-label">
            YOUR NAME
          </Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onEndEditing={() => update({ name: draftName.trim() })}
            onBlur={() => update({ name: draftName.trim() })}
            placeholder="Used in your daily greeting"
            placeholderTextColor={colors.muted}
            accessibilityLabelledBy="name-label"
            autoCapitalize="words"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>NEW CARDS PER DECK, PER DAY</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {PACES.map((n) => {
              const on = n === newCardsPerDay;
              return (
                <Pressable
                  key={n}
                  onPress={() => update({ newCardsPerDay: n })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.segmentItem, on && styles.segmentOn]}
                >
                  <Text style={[styles.segmentText, on && { color: colors.surface }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.label} nativeID="reminder-label">
                DAILY REMINDER
              </Text>
              <Text style={type.caption}>
                {!remindersSupported
                  ? 'Reminders work in the iOS and Android app.'
                  : reminderEnabled
                    ? `At ${formatTime(reminderHour, reminderMinute)} on days you have cards due — skipped once you've studied.`
                    : 'A gentle nudge on days you have cards due.'}
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={toggleReminder}
              disabled={!remindersSupported}
              accessibilityLabelledBy="reminder-label"
              trackColor={{ true: colors.accent, false: colors.line }}
              thumbColor={colors.surface}
            />
          </View>

          {denied && (
            <View style={{ gap: spacing.sm }}>
              <Text style={type.caption}>Notifications are turned off for Recall. Allow them in your phone’s settings, then try again.</Text>
              <Button title="Open settings" variant="secondary" onPress={() => Linking.openSettings()} />
            </View>
          )}

          {reminderEnabled && (
            <>
              <View style={styles.stepper}>
                <Pressable onPress={() => shiftTime(-15)} accessibilityRole="button" accessibilityLabel="15 minutes earlier" style={styles.stepButton}>
                  <Ionicons name="remove" size={22} color={colors.ink} />
                </Pressable>
                <Text style={styles.time} accessibilityLiveRegion="polite">
                  {formatTime(reminderHour, reminderMinute)}
                </Text>
                <Pressable onPress={() => shiftTime(15)} accessibilityRole="button" accessibilityLabel="15 minutes later" style={styles.stepButton}>
                  <Ionicons name="add" size={22} color={colors.ink} />
                </Pressable>
              </View>
              <Chips
                options={PRESETS.map(([h, m]): [string, string] => [`${h}:${m}`, formatTime(h, m)])}
                value={timeKey}
                onChange={(key) => {
                  const [h, m] = key.split(':').map(Number);
                  update({ reminderHour: h, reminderMinute: m });
                }}
                scroll
              />
              <Button
                title={testSent ? 'Test sent — leave the app to see it' : 'Send a test reminder'}
                variant="secondary"
                onPress={async () => {
                  await sendTestReminder();
                  setTestSent(true);
                }}
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={type.label}>LEARNING GOALS</Text>
          <Text style={type.body}>{goals.length ? goals.map((g) => GOAL_NAMES[g]).join(' · ') : 'None selected'}</Text>
          <Button
            title="Redo onboarding"
            variant="secondary"
            onPress={() => {
              resetOnboarding();
              // Settings sits on top of the tabs, so their <Redirect> wouldn't be visible; go there directly.
              router.replace('/onboarding');
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>TESTING</Text>
          <Text style={type.caption}>Sample decks include Code, Cloze and Vocabulary cards. Reset makes every card new again.</Text>
          <Button
            title={samplesAdded ? 'Sample decks added ✓' : 'Add sample decks'}
            variant="secondary"
            disabled={samplesAdded}
            onPress={async () => {
              await db.withTransactionAsync(() => seedSampleDecks(db));
              setSamplesAdded(true);
            }}
          />
          <Button title={resetDone ? 'Progress reset ✓' : 'Reset study progress'} variant="danger" onPress={reset} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
  section: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  input: {
    ...type.body,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ground,
  },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ground,
  },
  segmentOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ground,
  },
  time: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
});
