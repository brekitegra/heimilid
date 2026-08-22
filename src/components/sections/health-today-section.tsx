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
import { formatMonthDay } from '@/lib/date-locale';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useFoodLog } from '@/hooks/use-food-log';
import { useHealthProfile } from '@/hooks/use-health-profile';
import { useLanguage, useTranslation, type TranslationKey } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { isSameName } from '@/lib/duplicate-check';
import { round1, sanitizeNumericInput, parseDecimal } from '@/lib/number-format';
import type { FoodLogEntry, SavedFood } from '@/types/food-log';

// Sunday-first, matching Date.getDay() — see chore-format.ts's doc
// comment for why the *-format.ts libs branch on `language` directly
// instead of using t(); this one's local to this screen since the
// weekday name is only ever used for this one header.
const WEEKDAY_FULL_KEYS: TranslationKey[] = [
  'weekdaySunday',
  'weekdayMonday',
  'weekdayTuesday',
  'weekdayWednesday',
  'weekdayThursday',
  'weekdayFriday',
  'weekdaySaturday',
];

const MACRO_COLORS = { calories: '#C1633D', protein: '#4a90a4', fat: '#c9a227', carbs: '#7c9c6b' };

export function HealthTodaySection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const t = useTranslation();
  const { language } = useLanguage();
  const { profile } = useHealthProfile();
  const { entries, savedFoods, loading, addEntry, updateEntry, deleteEntry, addSavedFood, deleteSavedFood, logSavedFood } = useFoodLog();

  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const composerBlur = useDelayedBlur(setComposerFocused);
  const [submitting, setSubmitting] = useState(false);
  const isComposerExpanded = composerFocused || foodName.trim().length > 0 || editingEntryId !== null;

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

  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const dayLabel = `${t(WEEKDAY_FULL_KEYS[dateObj.getDay()])}, ${formatMonthDay(dateObj, language)}`;
  const isToday = selectedDate === toLocalISODate(new Date());

  function shiftDay(delta: number) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toLocalISODate(d));
  }

  function resetComposer() {
    setEditingEntryId(null);
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodFat('');
    setFoodCarbs('');
    setSaveAsFood(false);
  }

  function startEdit(entry: FoodLogEntry) {
    setEditingEntryId(entry.id);
    setFoodName(entry.name);
    setFoodCalories(String(entry.calories));
    setFoodProtein(String(round1(Number(entry.protein_g))));
    setFoodFat(String(round1(Number(entry.fat_g))));
    setFoodCarbs(String(round1(Number(entry.carbs_g))));
  }

  async function handleAddFood() {
    if (!foodName.trim()) return;
    setSubmitting(true);
    try {
      const input = {
        loggedDate: selectedDate,
        name: foodName,
        calories: parseDecimal(foodCalories),
        proteinG: parseDecimal(foodProtein),
        fatG: parseDecimal(foodFat),
        carbsG: parseDecimal(foodCarbs),
      };
      if (editingEntryId) {
        const entry = entries.find((e) => e.id === editingEntryId);
        if (entry) await updateEntry(entry, input);
      } else {
        await addEntry(input);
        if (saveAsFood) {
          await addSavedFood({ name: input.name, calories: input.calories, proteinG: input.proteinG, fatG: input.fatG, carbsG: input.carbsG });
        }
      }
      resetComposer();
    } catch (err) {
      showAlert(
        editingEntryId ? t('healthAlertSaveFoodFailedTitle') : t('healthAlertAddFoodFailedTitle'),
        err instanceof Error ? err.message : t('genericErrorMessage')
      );
    } finally {
      setSubmitting(false);
    }
  }

  // The composer's "save as food" checkbox only exists while you're still
  // typing a brand-new entry — once it's logged, that checkbox is gone
  // along with the rest of the composer, with no way back to it. This is
  // the other half of "save as food": saving one after the fact, from an
  // entry you've already logged (including ones you forgot to check the
  // box for, or logged before this button existed at all).
  async function handleSaveEntryAsFood(entry: FoodLogEntry) {
    if (savedFoods.some((f) => isSameName(f.name, entry.name))) {
      showAlert(t('errorAlreadyOnList'), t('healthAlreadySavedMessage', { name: entry.name }));
      return;
    }
    try {
      await addSavedFood({
        name: entry.name,
        calories: entry.calories,
        proteinG: Number(entry.protein_g),
        fatG: Number(entry.fat_g),
        carbsG: Number(entry.carbs_g),
      });
    } catch (err) {
      showAlert(t('healthAlertSaveEntryAsFoodFailedTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  async function handleLogSaved(food: SavedFood) {
    try {
      await logSavedFood(food, selectedDate);
    } catch (err) {
      showAlert(t('healthAlertLogFoodFailedTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
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
        <BackButton label={t('healthTitle')} onPress={onBack} />
      </View>

      <View style={styles.dayNavRow}>
        <NavArrowButton direction="prev" onPress={() => shiftDay(-1)} />
        <ThemedText type="smallBold">{isToday ? `${t('healthTodayDayPrefix')} · ${dayLabel}` : dayLabel}</ThemedText>
        <NavArrowButton direction="next" onPress={() => shiftDay(1)} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <ThemedView type="backgroundElement" style={styles.macroCard}>
          {!profile?.calorie_target && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('healthTodayNoTargetsMessage')}
            </ThemedText>
          )}
          {renderMacroBar(t('healthMacroCalories'), totals.calories, profile?.calorie_target ?? null, MACRO_COLORS.calories, t('healthUnitKcal'))}
          {renderMacroBar(t('healthMacroProtein'), totals.protein, profile?.protein_target_g ?? null, MACRO_COLORS.protein, t('healthUnitGrams'))}
          {renderMacroBar(t('healthMacroFat'), totals.fat, profile?.fat_target_g ?? null, MACRO_COLORS.fat, t('healthUnitGrams'))}
          {renderMacroBar(t('healthMacroCarbs'), totals.carbs, profile?.carb_target_g ?? null, MACRO_COLORS.carbs, t('healthUnitGrams'))}
        </ThemedView>

        <Animated.View layout={LinearTransition.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.addCard}>
            {editingEntryId && (
              <View style={styles.editingRow}>
                <ThemedText type="smallBold">{t('healthEditFoodHeading')}</ThemedText>
                <Pressable onPress={resetComposer} hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    {t('cancel')}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={t('healthFoodComposerPlaceholder')}
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
                    placeholder={t('healthUnitKcal')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={foodCalories}
                    onChangeText={(v) => setFoodCalories(sanitizeNumericInput(v))}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('healthPlaceholderProteinG')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={foodProtein}
                    onChangeText={(v) => setFoodProtein(sanitizeNumericInput(v))}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                </View>
                <View style={styles.macroInputsRow}>
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('healthPlaceholderFatG')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={foodFat}
                    onChangeText={(v) => setFoodFat(sanitizeNumericInput(v))}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                  <TextInput
                    style={[styles.input, styles.macroInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('healthPlaceholderCarbsG')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    value={foodCarbs}
                    onChangeText={(v) => setFoodCarbs(sanitizeNumericInput(v))}
                    onFocus={composerBlur.onFocus}
                    onBlur={composerBlur.onBlur}
                  />
                </View>

                {!editingEntryId && (
                  <Pressable onPressIn={composerBlur.onFocus} onPress={() => setSaveAsFood((v) => !v)} style={styles.saveFoodRow} hitSlop={4}>
                    <View style={[styles.checkbox, { borderColor: theme.backgroundSelected }, saveAsFood && { backgroundColor: theme.accent }]} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('healthSaveAsFoodLabel')}
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.addButton, { backgroundColor: theme.accent, opacity: foodName.trim() && !submitting ? 1 : 0.5 }]}
                  disabled={!foodName.trim() || submitting}
                  onPress={handleAddFood}>
                  {submitting ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText type="smallBold" themeColor="background">
                      {editingEntryId ? t('saveChanges') : t('healthAddFoodButton')}
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
            {t('healthTodayEmptyState')}
          </ThemedText>
        ) : (
          dayEntries.map((entry) => (
            <Animated.View key={entry.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(200)}>
              <ThemedView
                type="backgroundElement"
                style={[styles.entryRow, editingEntryId === entry.id && { borderColor: theme.accent, borderWidth: 1 }]}>
                <Pressable style={styles.entryTextWrapper} onPress={() => startEdit(entry)}>
                  <ThemedText type="default">{entry.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('healthEntrySummary', {
                      calories: entry.calories,
                      protein: round1(Number(entry.protein_g)),
                      proteinAbbr: t('healthAbbrProtein'),
                      fat: round1(Number(entry.fat_g)),
                      fatAbbr: t('healthAbbrFat'),
                      carbs: round1(Number(entry.carbs_g)),
                      carbsAbbr: t('healthAbbrCarbs'),
                    })}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => handleSaveEntryAsFood(entry)} hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    {t('healthSaveEntryButton')}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => deleteEntry(entry).catch(() => showAlert(t('healthAlertRemoveFoodFailedTitle')))} hitSlop={8}>
                  <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                    ×
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </Animated.View>
          ))
        )}

        <CollapsibleCard title={t('healthSavedFoodsSectionTitle')}>
          {savedFoods.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('healthSavedFoodsEmptyState')}
            </ThemedText>
          ) : (
            savedFoods.map((food) => (
              <View key={food.id} style={styles.savedFoodRow}>
                <Pressable style={styles.entryTextWrapper} onPress={() => handleLogSaved(food)}>
                  <ThemedText type="small">{food.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('healthEntrySummary', {
                      calories: food.calories,
                      protein: round1(Number(food.protein_g)),
                      proteinAbbr: t('healthAbbrProtein'),
                      fat: round1(Number(food.fat_g)),
                      fatAbbr: t('healthAbbrFat'),
                      carbs: round1(Number(food.carbs_g)),
                      carbsAbbr: t('healthAbbrCarbs'),
                    })}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => deleteSavedFood(food).catch(() => showAlert(t('healthAlertRemoveSavedFoodFailedTitle')))} hitSlop={8}>
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
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  // minWidth: 0 — same web flexbox fix documented in the other sections'
  // pillRow/*TextWrapper styles: without it, a long food entry name
  // won't shrink to wrap and instead overflows past the card's edge.
  entryTextWrapper: { flex: 1, minWidth: 0, gap: Spacing.half },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  savedFoodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
});
