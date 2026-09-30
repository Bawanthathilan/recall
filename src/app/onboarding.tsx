import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { isSinhala, setLanguage, t } from '@/i18n';
import { useSettings, type Goal } from '@/store/settings';
import { colors, fonts, lineHeight, radius, spacing, touchTarget, type } from '@/theme';

const GOAL_ICONS: Record<Goal, keyof typeof Ionicons.glyphMap> = {
  code: 'code-slash',
  university: 'school-outline',
  language: 'language',
  exam: 'calendar-outline',
  medicine: 'medkit-outline',
  other: 'add-circle-outline',
};
const GOALS = (Object.keys(GOAL_ICONS) as Goal[]).map((id) => ({
  id,
  icon: GOAL_ICONS[id],
  title: t(`goals.${id}.title`),
  body: t(`goals.${id}.body`),
}));

const PACES = (
  [
    [10, 'relaxed'],
    [20, 'steady'],
    [30, 'intense'],
    [50, 'cramming'],
  ] as const
).map(([n, key]) => ({ n, title: t(`onboarding.paces.${key}.title`), body: t(`onboarding.paces.${key}.body`) }));

export default function Onboarding() {
  const saved = useSettings();
  const [step, setStep] = useState(1);
  // Start from saved values, so "Redo onboarding" shows your previous answers.
  const [goals, setGoals] = useState<Goal[]>(saved.goals);
  const [name, setName] = useState(saved.name);
  const [pace, setPace] = useState(saved.newCardsPerDay);

  // Once settings are saved, this re-renders and sends you to the Today tab.
  if (saved.onboarded) return <Redirect href="/" />;

  const toggle = (g: Goal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const next = () =>
    step < 3 ? setStep(step + 1) : saved.completeOnboarding({ goals, name: name.trim(), newCardsPerDay: pace });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo />
            {step === 1 ? (
              // Switch language before answering anything (the app restarts in the other language).
              <Pressable
                onPress={() => setLanguage(isSinhala ? 'en' : 'si')}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.switchLanguageA11y')}
                style={styles.language}
              >
                <Ionicons name="language" size={16} color={colors.ink} />
                <Text style={styles.languageText}>{t('onboarding.switchLanguage')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.step}>{t('onboarding.step', { step })}</Text>
            )}
          </View>

          {step === 1 && (
            <>
              <Intro title={t('onboarding.goalsTitle')} body={t('onboarding.goalsBody')} />
              <View style={styles.grid}>
                {GOALS.map((g) => {
                  const on = goals.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggle(g.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${g.title}. ${g.body}`}
                      style={[styles.goal, on && styles.goalOn]}
                    >
                      <Ionicons name={g.icon} size={26} color={colors.ink} />
                      <Text style={styles.goalTitle}>{g.title}</Text>
                      <Text style={styles.goalBody}>{g.body}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Intro title={t('onboarding.nameTitle')} body={t('onboarding.nameBody')} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.namePlaceholder')}
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('onboarding.namePlaceholder')}
                autoFocus
                autoCapitalize="words"
                autoComplete="given-name"
                returnKeyType="next"
                onSubmitEditing={next}
                style={styles.input}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Intro title={t('onboarding.paceTitle')} body={t('onboarding.paceBody')} />
              <View style={{ gap: spacing.md }}>
                {PACES.map((p) => {
                  const on = p.n === pace;
                  return (
                    <Pressable
                      key={p.n}
                      onPress={() => setPace(p.n)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={t('onboarding.paceA11y', { count: p.n, title: p.title, body: p.body })}
                      style={[styles.pace, on && styles.goalOn]}
                    >
                      <Text style={styles.paceNumber}>{p.n}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalTitle}>{p.title}</Text>
                        <Text style={styles.goalBody}>{p.body}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={step === 1 && !goals.length ? t('onboarding.pickOne') : step === 3 ? t('onboarding.start') : t('onboarding.continue')}
            disabled={step === 1 && !goals.length}
            onPress={next}
          />
          {step > 1 ? (
            <Pressable onPress={() => setStep(step - 1)} accessibilityRole="button" style={styles.secondary}>
              <Text style={styles.secondaryText}>{t('common.back')}</Text>
            </Pressable>
          ) : (
            <View style={styles.secondary} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Intro({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={type.display} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[type.body, { color: colors.muted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: 24, paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  language: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touchTarget,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // Always the other language's own script, so it's readable to whoever needs it.
  languageText: { fontFamily: isSinhala ? fonts.bodySemi : 'NotoSansSinhala_600SemiBold', fontSize: 14, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  goal: {
    // Two columns: each ~half the width; flexGrow absorbs the gap.
    width: '45%',
    flexGrow: 1,
    minHeight: 132,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  goalOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  goalTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  goalBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: lineHeight(13, 18), color: colors.muted },
  input: {
    ...type.body,
    fontSize: 18,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: touchTarget + 28,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  paceNumber: { fontFamily: fonts.heading, fontSize: 28, width: 44, textAlign: 'center', color: colors.ink },
  footer: { paddingHorizontal: 24, paddingTop: spacing.md, gap: 4 },
  secondary: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
});
