import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHealthProfile } from '@/hooks/use-health-profile';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { ACTIVITY_LEVELS, computeBMR, computeMacroTargets, computeTDEE, GOALS } from '@/lib/tdee';
import { parseDecimal, round1 } from '@/lib/number-format';
import type { ActivityLevel, Goal, Sex } from '@/types/health-profile';

export function HealthProfileSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
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
    const ageNum = Number(age);
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
      showAlert('Saved', 'Your health profile has been updated.');
    } catch (err) {
      showAlert("Couldn't save", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  function renderPillRow<T extends string>(options: { value: T; label: string; hint?: string }[], selected: T | null, onSelect: (v: T) => void) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.pill, { backgroundColor: theme.backgroundSelected }, selected === opt.value && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={selected === opt.value ? 'background' : 'textSecondary'}>
              {opt.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label="Health" onPress={onBack} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.sectionHeader}>
              TDEE CALCULATOR
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Fill these in and tap Calculate for suggested daily targets — every target below stays fully editable afterward.
            </ThemedText>

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="Age (years)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
            />
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="Weight (kg)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="Height (cm)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />

            <ThemedText type="small" themeColor="textSecondary">
              Sex
            </ThemedText>
            {renderPillRow(
              [
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ],
              sex,
              setSex
            )}

            <ThemedText type="small" themeColor="textSecondary">
              Activity level
            </ThemedText>
            {renderPillRow(ACTIVITY_LEVELS, activityLevel, setActivityLevel)}

            <ThemedText type="small" themeColor="textSecondary">
              Goal
            </ThemedText>
            {renderPillRow(GOALS, goal, setGoal)}

            <Pressable
              style={[styles.addButton, { backgroundColor: theme.accent, opacity: canCalculate ? 1 : 0.5 }]}
              disabled={!canCalculate}
              onPress={handleCalculate}>
              <ThemedText type="smallBold" themeColor="background">
                Calculate
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.sectionHeader}>
              DAILY TARGETS
            </ThemedText>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                Calories
              </ThemedText>
              <TextInput
                style={[styles.input, styles.targetInput, { color: theme.text, backgroundColor: theme.background }]}
                keyboardType="number-pad"
                value={calorieTarget}
                onChangeText={setCalorieTarget}
                placeholder="kcal"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                Protein
              </ThemedText>
              <TextInput
                style={[styles.input, styles.targetInput, { color: theme.text, backgroundColor: theme.background }]}
                keyboardType="number-pad"
                value={proteinTarget}
                onChangeText={setProteinTarget}
                placeholder="g"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                Fat
              </ThemedText>
              <TextInput
                style={[styles.input, styles.targetInput, { color: theme.text, backgroundColor: theme.background }]}
                keyboardType="number-pad"
                value={fatTarget}
                onChangeText={setFatTarget}
                placeholder="g"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.targetRow}>
              <ThemedText type="small" style={styles.targetLabel}>
                Carbs
              </ThemedText>
              <TextInput
                style={[styles.input, styles.targetInput, { color: theme.text, backgroundColor: theme.background }]}
                keyboardType="number-pad"
                value={carbTarget}
                onChangeText={setCarbTarget}
                placeholder="g"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <Pressable style={[styles.addButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]} disabled={saving} onPress={handleSave}>
              {saving ? <ActivityIndicator color={theme.background} /> : (
                <ThemedText type="smallBold" themeColor="background">
                  Save
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
  pillRow: { flexGrow: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  targetLabel: { flex: 1 },
  // minWidth: 0 overrides web's default min-width:auto on flex items —
  // without it the rendered <input>'s intrinsic size wins over
  // flex-grow and the row overflows instead of splitting evenly.
  targetInput: { flex: 1, minWidth: 0 },
});
