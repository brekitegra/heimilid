import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHealthProfile } from '@/hooks/use-health-profile';
import { useTranslation, type TranslationKey } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { ACTIVITY_LEVELS, computeBMR, computeMacroTargets, computeTDEE, GOALS } from '@/lib/tdee';
import { parseDecimal, round1, sanitizeNumericInput } from '@/lib/number-format';
import type { ActivityLevel, Goal, Sex } from '@/types/health-profile';

// renderPillRow's `hint` field is declared but never rendered by this
// component (dead code that predates this pass), so only label lookups
// are needed here — translating an unrendered field would be pointless.
const ACTIVITY_LABEL_KEY: Record<ActivityLevel, TranslationKey> = {
  sedentary: 'healthActivitySedentary',
  light: 'healthActivityLight',
  moderate: 'healthActivityModerate',
  active: 'healthActivityActive',
  very_active: 'healthActivityVeryActive',
};
const GOAL_LABEL_KEY: Record<Goal, TranslationKey> = {
  cut: 'healthGoalCut',
  maintain: 'healthGoalMaintain',
  bulk: 'healthGoalBulk',
};

export function HealthProfileSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const t = useTranslation();
  const { profile, loading, save } = useHealthProfile();

  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const [calorieTarget, setCalorieTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');
  const [fatTarget, setFatTarget] = useState('');
  const [carbTarget, setCarbTarget] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the form once the profile actually loads — keyed on id only (see
  // profile.tsx's About You form for the identical precedent) so a later
  // re-fetch from our own save doesn't stomp on further edits in progress.
  useEffect(() => {
    if (!profile) return;
    // Seeding local edit state from a freshly (re)loaded profile, not
    // synchronizing with an external system on every render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setAge(profile.age ? String(profile.age) : '');
    // weight_kg/height_cm are numeric(x,2) columns — Postgres serializes those
    // as strings with trailing zeros (e.g. "80.50"), so round-trip through
    // Number()+round1 to show a clean "80.5" instead.
    setWeight(profile.weight_kg ? String(round1(Number(profile.weight_kg))) : '');
    setHeight(profile.height_cm ? String(round1(Number(profile.height_cm))) : '');
    setSex(profile.sex);
    setActivityLevel(profile.activity_level);
    setGoal(profile.goal);
    setCalorieTarget(profile.calorie_target ? String(profile.calorie_target) : '');
    setProteinTarget(profile.protein_target_g ? String(profile.protein_target_g) : '');
    setFatTarget(profile.fat_target_g ? String(profile.fat_target_g) : '');
    setCarbTarget(profile.carb_target_g ? String(profile.carb_target_g) : '');
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const canCalculate = !!(age.trim() && weight.trim() && height.trim() && sex && activityLevel && goal);

  function handleCalculate() {
    if (!canCalculate || !sex || !activityLevel || !goal) return;
    const ageNum = parseDecimal(age);
    const weightNum = parseDecimal(weight);
    const heightNum = parseDecimal(height);
    const bmr = computeBMR(sex, weightNum, heightNum, ageNum);
    const tdee = computeTDEE(bmr, activityLevel);
    const targets = computeMacroTargets(tdee, goal, weightNum);
    setCalorieTarget(String(targets.calorieTarget));
    setProteinTarget(String(targets.proteinTargetG));
    setFatTarget(String(targets.fatTargetG));
    setCarbTarget(String(targets.carbTargetG));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        age: age.trim() ? Number(age) : null,
        weightKg: weight.trim() ? parseDecimal(weight) : null,
        heightCm: height.trim() ? parseDecimal(height) : null,
        sex,
        activityLevel,
        goal,
        calorieTarget: calorieTarget.trim() ? Number(calorieTarget) : null,
        proteinTargetG: proteinTarget.trim() ? Number(proteinTarget) : null,
        fatTargetG: fatTarget.trim() ? Number(fatTarget) : null,
        carbTargetG: carbTarget.trim() ? Number(carbTarget) : null,
      });
      showAlert(t('healthAlertProfileSavedTitle'), t('healthAlertProfileSavedMessage'));
    } catch (err) {
      showAlert(t('healthAlertSaveFailedTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSaving(false);
    }
  }

  function renderPillRow<T extends string>(
    options: { value: T; label: string }[],
    selected: T | null,
    onSelect: (v: T) => void,
    labelFor?: (value: T) => string
  ) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.pill, { backgroundColor: theme.backgroundSelected }, selected === opt.value && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={selected === opt.value ? 'background' : 'textSecondary'}>
              {labelFor ? labelFor(opt.value) : opt.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label={t('healthTitle')} onPress={onBack} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.sectionHeader}>
              {t('healthTdeeCalculatorHeader')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('healthTdeeCalculatorHint')}
            </ThemedText>

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('healthPlaceholderAge')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={age}
              onChangeText={(v) => setAge(sanitizeNumericInput(v))}
            />
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('healthPlaceholderWeight')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={(v) => setWeight(sanitizeNumericInput(v))}
            />
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('healthPlaceholderHeight')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={(v) => setHeight(sanitizeNumericInput(v))}
            />

            <ThemedText type="small" themeColor="textSecondary">
              {t('healthSexLabel')}
            </ThemedText>
            {renderPillRow(
              [
                { value: 'male', label: t('healthSexMale') },
                { value: 'female', label: t('healthSexFemale') },
              ],
              sex,
              setSex
            )}

            <ThemedText type="small" themeColor="textSecondary">
              {t('healthActivityLevelLabel')}
            </ThemedText>
            {renderPillRow(ACTIVITY_LEVELS, activityLevel, setActivityLevel, (v) => t(ACTIVITY_LABEL_KEY[v]))}

            <ThemedText type="small" themeColor="textSecondary">
              {t('healthGoalLabel')}
            </ThemedText>
            {renderPillRow(GOALS, goal, setGoal, (v) => t(GOAL_LABEL_KEY[v]))}

            <Pressable
              style={[styles.addButton, { backgroundColor: theme.accent, opacity: canCalculate ? 1 : 0.5 }]}
              disabled={!canCalculate}
              onPress={handleCalculate}>
              <ThemedText type="smallBold" themeColor="background">
                {t('healthCalculateButton')}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.sectionHeader}>
              {t('healthDailyTargetsHeader')}
            </ThemedText>
            {/* Read-only display, not TextInputs — these are only ever
                derived from Calculate above, never hand-typed. A stray
                manual edit here used to be able to drift silently out of
                sync with what Calculate would actually produce from the
                same inputs, with no way to tell the two apart later. */}
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                {t('healthMacroCalories')}
              </ThemedText>
              <ThemedText type="small" style={styles.targetValue}>
                {calorieTarget || '—'} {t('healthUnitKcal')}
              </ThemedText>
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                {t('healthMacroProtein')}
              </ThemedText>
              <ThemedText type="small" style={styles.targetValue}>
                {proteinTarget || '—'} {t('healthUnitGrams')}
              </ThemedText>
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                {t('healthMacroFat')}
              </ThemedText>
              <ThemedText type="small" style={styles.targetValue}>
                {fatTarget || '—'} {t('healthUnitGrams')}
              </ThemedText>
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                {t('healthMacroCarbs')}
              </ThemedText>
              <ThemedText type="small" style={styles.targetValue}>
                {carbTarget || '—'} {t('healthUnitGrams')}
              </ThemedText>
            </View>

            <Pressable style={[styles.addButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]} disabled={saving} onPress={handleSave}>
              {saving ? <ActivityIndicator color={theme.background} /> : (
                <ThemedText type="smallBold" themeColor="background">
                  {t('save')}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  loadingSpinner: { marginTop: Spacing.six },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  sectionHeader: { letterSpacing: 0.5 },
  input: { fontSize: 16, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  // flexShrink: 1 + minWidth: 0 — see kids-section.tsx's identical
  // pillRow comment (RN's flexShrink defaults to 0 for a plain
  // ScrollView, and web's min-width:auto blocks shrinking even with
  // flexShrink set) — without both, a pill row wider than its card
  // overflows the rounded edge and clips the last pill.
  pillRow: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  targetLabel: { flex: 1 },
  targetValue: { flex: 1, textAlign: 'right' },
});
