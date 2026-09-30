import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chips } from '@/components/FormControls';
import { resyncReminders } from '@/components/ReminderSync';
import { backupCounts, backupFileName, BackupError, createBackup, parseBackup, restoreBackup } from '@/db/backup';
import { resetAllProgress } from '@/db/queries';
import { seedSampleDecks } from '@/db/seed';
import { accountsEnabled, appleSignInEnabled, profile, providerName, signOut, useSession } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/nav';
import { pickFile, saveFile } from '@/lib/files';
import { enableReminders, remindersSupported, sendTestReminder } from '@/lib/notifications';
import { language, setLanguage, t, type Language } from '@/i18n';
import { formatDate } from '@/i18n/dates';
import { formatTime } from '@/lib/reminders';
import { useSettings, type Goal } from '@/store/settings';
import { colors, fonts, radius, spacing, touchTarget, type } from '@/theme';

const goalName = (g: Goal) => t(`goals.${g}.title`);

/** Language names are written in their own script, whatever the app's language. */
const LANGUAGE_OPTIONS: [Language, string][] = [
  ['en', 'English'],
  ['si', 'සිංහල'],
];

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
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const session = useSession();
  const account = session ? profile(session) : null;
  // The name can change outside this screen (signing in fills it from Google), so keep the text field in step.
  // (Adjusting state during render is React's recommended alternative to an effect here.)
  const [shownName, setShownName] = useState(name);
  if (name !== shownName) {
    setShownName(name);
    setDraftName(name);
  }

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
    if (!(await confirm(t('settings.resetTitle'), t('settings.resetBody'), t('settings.resetConfirm')))) return;
    await resetAllProgress(db);
    setResetDone(true);
  }

  async function backUp() {
    const backup = await createBackup(db);
    const { decks, cards } = backupCounts(backup);
    await saveFile(backupFileName(), JSON.stringify(backup), 'application/json', 'public.json');
    setDataStatus(t('settings.backupMade', { decks: t('common.decks', { count: decks }), cards: t('common.cards', { count: cards }) }));
  }

  async function restore() {
    setDataStatus(null);
    const file = await pickFile();
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const { decks, cards, reviews } = backupCounts(backup);
      const made = formatDate(new Date(backup.exportedAt), { day: true, month: 'long', year: true });
      const ok = await confirm(
        t('settings.restoreTitle'),
        t('settings.restoreBody', {
          date: made,
          decks: t('common.decks', { count: decks }),
          cards: t('common.cards', { count: cards }),
          reviews: t('common.reviews', { count: reviews }),
        }),
        t('settings.restoreConfirm'),
      );
      if (!ok) return;
      await restoreBackup(db, backup);
      resyncReminders(db);
      setDataStatus(t('settings.restored', { decks: t('common.decks', { count: decks }), cards: t('common.cards', { count: cards }) }));
    } catch (e) {
      setDataStatus(e instanceof BackupError ? e.message : t('settings.restoreFailed'));
      if (!(e instanceof BackupError)) console.warn('Restore failed', e);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={type.title}>{t('common.settings')}</Text>
        </View>

        {/* Hidden in v1.0 — see accountsEnabled in src/lib/auth.ts. */}
        {accountsEnabled && (
          <View style={styles.section}>
            <Text style={type.label}>{t('settings.account')}</Text>
            {session && account ? (
              <>
                <View style={styles.accountRow}>
                  <Avatar name={account.name || session.user.email || '?'} photoUrl={account.photoUrl} size={touchTarget + 8} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {!!account.name && <Text style={type.bodySemi}>{account.name}</Text>}
                    <Text style={type.caption} numberOfLines={1}>
                      {session.user.email ?? t('settings.privateEmail')} · {providerName(session)}
                    </Text>
                  </View>
                </View>
                <Text style={type.caption}>{t('settings.syncSoon')}</Text>
                <Button
                  title={t('settings.signOut')}
                  variant="secondary"
                  onPress={async () => {
                    if (await confirm(t('settings.signOutTitle'), t('settings.signOutBody'), t('settings.signOut'))) await signOut();
                  }}
                />
              </>
            ) : (
              <>
                <Text style={type.caption}>
                  {t('settings.signInPrompt', { providers: appleSignInEnabled ? 'Apple, Google' : 'Google' })}
                </Text>
                <Button title={t('settings.signIn')} variant="secondary" disabled={session === undefined} onPress={() => router.push('/sign-in')} />
              </>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={type.label}>{t('settings.language')}</Text>
          <Chips
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(lang) => lang !== language && setLanguage(lang)}
          />
          <Text style={type.caption}>{t('settings.languageNote')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={type.label} nativeID="name-label">
            {t('settings.name')}
          </Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onEndEditing={() => update({ name: draftName.trim() })}
            onBlur={() => update({ name: draftName.trim() })}
            placeholder={t('settings.namePlaceholder')}
            placeholderTextColor={colors.muted}
            accessibilityLabelledBy="name-label"
            autoCapitalize="words"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>{t('settings.newCards')}</Text>
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
                {t('settings.reminder')}
              </Text>
              <Text style={type.caption}>
                {!remindersSupported
                  ? t('settings.reminderUnsupported')
                  : reminderEnabled
                    ? t('settings.reminderOn', { time: formatTime(reminderHour, reminderMinute) })
                    : t('settings.reminderOff')}
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
              <Text style={type.caption}>{t('settings.notificationsOff')}</Text>
              <Button title={t('settings.openSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
            </View>
          )}

          {reminderEnabled && (
            <>
              <View style={styles.stepper}>
                <Pressable onPress={() => shiftTime(-15)} accessibilityRole="button" accessibilityLabel={t('settings.earlier')} style={styles.stepButton}>
                  <Ionicons name="remove" size={22} color={colors.ink} />
                </Pressable>
                <Text style={styles.time} accessibilityLiveRegion="polite">
                  {formatTime(reminderHour, reminderMinute)}
                </Text>
                <Pressable onPress={() => shiftTime(15)} accessibilityRole="button" accessibilityLabel={t('settings.later')} style={styles.stepButton}>
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
                title={testSent ? t('settings.testSent') : t('settings.sendTest')}
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
          <Text style={type.label}>{t('settings.goals')}</Text>
          <Text style={type.body}>{goals.length ? goals.map(goalName).join(' · ') : t('settings.noGoals')}</Text>
          <Button
            title={t('settings.redoOnboarding')}
            variant="secondary"
            onPress={() => {
              resetOnboarding();
              // Settings sits on top of the tabs, so their <Redirect> wouldn't be visible; go there directly.
              router.replace('/onboarding');
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={type.label}>{t('settings.data')}</Text>
          <Text style={type.caption}>{t('settings.dataBody')}</Text>
          <Button title={t('settings.backUp')} variant="secondary" onPress={backUp} />
          <Button title={t('settings.restore')} variant="secondary" onPress={restore} />
          {dataStatus && (
            <Text style={type.caption} accessibilityLiveRegion="polite">
              {dataStatus}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={type.label}>{t('settings.sample')}</Text>
          <Text style={type.caption}>{t('settings.sampleBody')}</Text>
          <Button
            title={samplesAdded ? t('settings.samplesAdded') : t('settings.addSamples')}
            variant="secondary"
            disabled={samplesAdded}
            onPress={async () => {
              await db.withTransactionAsync(() => seedSampleDecks(db));
              setSamplesAdded(true);
            }}
          />
          <Button title={resetDone ? t('settings.progressReset') : t('settings.resetProgress')} variant="danger" onPress={reset} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
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
