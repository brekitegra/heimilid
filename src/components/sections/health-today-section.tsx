import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { CollapsibleCard } from '@/components/collapsible-card';
import { NavArrowButton } from '@/components/nav-arrow-button';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { toLocalISODate } from '@/lib/date-format';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useFoodLog } from '@/hooks/use-food-log';
import { useHealthProfile } from '@/hooks/use-health-profile';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { round1 } from '@/lib/number-format';
import type { SavedFood } from '@/types/food-log';

const MACRO_COLORS = { calories: '#C1633D', protein: '#4a90a4', fat: '#c9a227', carbs: '#7c9c6b' };

export function HealthTodaySection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { profile } = useHealthProfile();
  const { entries, savedFoods, loading, addEntry, deleteEntry, addSavedFood, deleteSavedFood, logSavedFood } = useFoodLog();

  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));

  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const composerBlur = useDelayedBlur(setComposerFocused);
  const [submitting, setSubmitting] = useState(false);
  const isComposerExpanded = composerFocused || foodName.trim().length > 0;

  const [saveAsFood, setSaveAsFood] = useState(false);

  const dayEntries = useMemo(() => entries.filter((e) => e.logged_date === selectedDate), [entries, selectedDate]);
  const totals = useMemo(
    () =>
      dayEntries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + Number(e.protein_g),
          fat: acc.fat + Number(e.fat_g),
          carbs: acc.carbs + Number(e.carbs_g),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      ),
    [dayEntries]
  );

  const dayLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const isToday = selectedDate === toLocalISODate(new Date());

  function shiftDay(delta: number) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toLocalISODate(d));
  }

  function resetComposer() {
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodFat('');
    setFoodCarbs('');
    setSaveAsFood(false);
  }

  async function handleAddFood() {
    if (!foodName.trim()) return;
    setSubmitting(true);
    try {
      const input = {
        loggedDate: selectedDate,
        name: foodName,
        calories: Number(foodCalories) || 0,
        proteinG: Number(foodProtein) || 0,
        fatG: Number(foodFat) || 0,
        carbsG: Number(foodCarbs) || 0,
      };
      await addEntry(input);
      if (saveAsFood) {
        await addSavedFood({ name: input.name, calories: input.calories, proteinG: input.proteinG, fatG: input.fatG, carbsG: input.carbsG });
      }
      resetComposer();
    } catch (err) {
      showAlert("Couldn't add food", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogSaved(food: SavedFood) {
    try {
      await logSavedFood(food, selectedDate);
    } catch (err) {
      showAlert("Couldn't log food", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function renderMacroBar(label: string, consumed: number, target: number | null, color: string, unit: string) {
    const progress = target && target > 0 ? consumed / target : 0;
    return (
      <View style={styles.macroRow}>
        <View style={styles.macroLabelRow}>
          <ThemedText type="small">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {round1(consumed)}
            {target ? ` / ${target}` : ''} {unit}
          </ThemedText>
        </View>
        <ProgressBar progress={progress} color={color} height={10} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label="Health" onPress={onBack} />
      </View>

      <View style={styles.dayNavRow}>
        <NavArrowButton direction="prev" onPress={() => shiftDay(-1)} />
        <ThemedText type="smallBold">{isToday ? `Today · ${dayLabel}` : dayLabel}</ThemedText>
        <NavArrowButton direction="next" onPress={() => shiftDay(1)} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <ThemedView type="backgroundElement" style={styles.macroCard}>
          {!profile?.calorie_target && (
            <ThemedText type="small" themeColor="textSecondary">
              No targets set yet — set them up in the Profile tab to see progress bars here.
            </ThemedText>
          )}
          {renderMacroBar('Calories', totals.calories, profile?.calorie_target ?? null, MACRO_COLORS.calories, 'kcal')}
          {renderMacroBar('Protein', totals.protein, profile?.protein_target_g ?? null, MACRO_COLORS.protein, 'g')}
          {renderMacroBar('Fat', totals.fat, profile?.fat_target_g ?? null, MACRO_COLORS.fat, 'g')}
          {renderMacroBar('Carbs', totals.carbs, profile?.carb_target_g ?? null, MACRO_COLORS.carbs, 'g')}
        </ThemedView>

        <Animated.View layout={LinearTransition.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Add a food…"
              placeholderTextColor={theme.textSecondary}
              value={foodName}
              onChangeText={setFoodName}
              onFocus={composerBlur.onFocus}
              onBlur={composerBlur.onBlur}
              returnKeyType="done"
            />
            {isComposerExpanded && (
              <>
                <View style={styles.macroInputsRow}>
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="kcal"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={foodCalories}
                    onChangeText={setFoodCalories}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Protein g"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={foodProtein}
                    onChangeText={setFoodProtein}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                </View>
                <View style={styles.macroInputsRow}>
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Fat g"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={foodFat}
                    onChangeText={setFoodFat}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Carbs g"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={foodCarbs}
                    onChangeText={setFoodCarbs}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                </View>

                <Pressable onPress={() => setSaveAsFood((v) => !v)} style={styles.saveFoodRow} hitSlop={4}>
                  <View style={[styles.checkbox, { borderColor: theme.backgroundSelected }, saveAsFood && { backgroundColor: theme.accent }]} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Save as a food for quick re-logging
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.addButton, { backgroundColor: theme.accent, opacity: foodName.trim() && !submitting ? 1 : 0.5 }]}
                  disabled={!foodName.trim() || submitting}
                  onPress={handleAddFood}>
                  {submitting ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText type="smallBold" themeColor="background">
                      Add
                    </ThemedText>
                  )}
                </Pressable>
              </>
            )}
          </ThemedView>
        </Animated.View>

        {loading && entries.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {dayEntries.length === 0 && !loading ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            Nothing logged for this day yet.
          </ThemedText>
        ) : (
          dayEntries.map((entry) => (
            <Animated.View key={entry.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(200)}>
              <ThemedView type="backgroundElement" style={styles.entryRow}>
                <View style={styles.entryTextWrapper}>
                  <ThemedText type="default">{entry.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.calories} kcal · {round1(Number(entry.protein_g))}p · {round1(Number(entry.fat_g))}f · {round1(Number(entry.carbs_g))}c
                  </ThemedText>
                </View>
                <Pressable onPress={() => deleteEntry(entry).catch(() => showAlert("Couldn't remove food"))} hitSlop={8}>
                  <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                    ×
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </Animated.View>
          ))
        )}

        <CollapsibleCard title="SAVED FOODS">
          {savedFoods.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No saved foods yet — check &quot;Save as a food&quot; when logging one above.
            </ThemedText>
          ) : (
            savedFoods.map((food) => (
              <View key={food.id} style={styles.savedFoodRow}>
                <Pressable style={styles.entryTextWrapper} onPress={() => handleLogSaved(food)}>
                  <ThemedText type="small">{food.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {food.calories} kcal · {round1(Number(food.protein_g))}p · {round1(Number(food.fat_g))}f · {round1(Number(food.carbs_g))}c
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => deleteSavedFood(food).catch(() => showAlert("Couldn't remove saved food"))} hitSlop={8}>
                  <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                    ×
                  </ThemedText>
                </Pressable>
              </View>
            ))
          )}
        </CollapsibleCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  dayNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingBottom: Spacing.four },
  macroCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.three },
  macroRow: { gap: Spacing.one },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addCard: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  input: { fontSize: 16, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  macroInputsRow: { flexDirection: 'row', gap: Spacing.two },
  macroInput: { flex: 1, minWidth: 0 },
  saveFoodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1 },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  loadingSpinner: { marginTop: Spacing.six },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.three },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  entryTextWrapper: { flex: 1, gap: Spacing.half },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  savedFoodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
});
