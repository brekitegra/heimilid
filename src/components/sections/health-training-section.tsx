import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { localIsoDateInDays } from '@/lib/date-format';
import { formatDueDate } from '@/lib/chore-format';
import { parseDecimal, round1 } from '@/lib/number-format';
import { formatWorkoutLastDone, formatWorkoutStreak } from '@/lib/workout-format';
import { isWorkoutDoneNow, useWorkouts } from '@/hooks/use-workouts';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import type { Workout, WorkoutExercise, WorkoutInput } from '@/types/workout';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_DATE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Today', value: localIsoDateInDays(0) },
  { label: 'Tomorrow', value: localIsoDateInDays(1) },
  { label: 'In 3 days', value: localIsoDateInDays(3) },
  { label: 'In a week', value: localIsoDateInDays(7) },
];

function formatSetsRepsWeight(sets: number | null, reps: number | null, weight: number | null): string | null {
  if (!sets && !reps && !weight) return null;
  const parts: string[] = [];
  if (sets && reps) parts.push(`${sets}×${reps}`);
  else if (sets) parts.push(`${sets} sets`);
  else if (reps) parts.push(`${reps} reps`);
  // weight is a numeric(x,2) column — comes back as a string with trailing
  // zeros (e.g. "60.00"), so clean it up before displaying.
  if (weight) parts.push(`${round1(Number(weight))}kg`);
  return parts.join(' @ ') || null;
}

export function HealthTrainingSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const {
    workouts,
    exercises,
    loading,
    addWorkout,
    updateWorkout,
    toggleWorkout,
    deleteWorkout,
    addExercise,
    updateExercise,
    updateExerciseActuals,
    deleteExercise,
  } = useWorkouts();

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [workoutIsRecurring, setWorkoutIsRecurring] = useState(true);
  const [workoutDayOfWeek, setWorkoutDayOfWeek] = useState(1);
  const [workoutEventDate, setWorkoutEventDate] = useState(EVENT_DATE_OPTIONS[0].value);
  const [workoutSubmitting, setWorkoutSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const [exerciseComposerWorkoutId, setExerciseComposerWorkoutId] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [actualSets, setActualSets] = useState('');
  const [actualReps, setActualReps] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [exerciseSubmitting, setExerciseSubmitting] = useState(false);

  const exercisesByWorkout = useMemo(() => {
    const map = new Map<string, WorkoutExercise[]>();
    for (const ex of exercises) {
      const bucket = map.get(ex.workout_id);
      if (bucket) bucket.push(ex);
      else map.set(ex.workout_id, [ex]);
    }
    return map;
  }, [exercises]);

  // Completed one-off workouts drop off the list, same as Chores/Pets/Kids —
  // recurring ones stay visible with a strikethrough instead.
  const visibleWorkouts = useMemo(() => workouts.filter((w) => w.is_recurring || !w.is_done), [workouts]);

  function resetWorkoutForm() {
    setEditingWorkoutId(null);
    setWorkoutTitle('');
    setWorkoutNotes('');
    setWorkoutIsRecurring(true);
    setWorkoutDayOfWeek(1);
    setWorkoutEventDate(EVENT_DATE_OPTIONS[0].value);
    setComposerOpen(false);
  }

  function startEditWorkout(workout: Workout) {
    setEditingWorkoutId(workout.id);
    setWorkoutTitle(workout.title);
    setWorkoutNotes(workout.notes ?? '');
    setWorkoutIsRecurring(workout.is_recurring);
    setWorkoutDayOfWeek(workout.day_of_week ?? 1);
    setWorkoutEventDate(workout.event_date ?? EVENT_DATE_OPTIONS[0].value);
    setComposerOpen(true);
  }

  async function handleWorkoutSubmit() {
    if (!workoutTitle.trim()) return;
    const input: WorkoutInput = {
      title: workoutTitle,
      notes: workoutNotes.trim() || null,
      isRecurring: workoutIsRecurring,
      dayOfWeek: workoutIsRecurring ? workoutDayOfWeek : null,
      eventDate: workoutIsRecurring ? null : workoutEventDate,
    };
    setWorkoutSubmitting(true);
    try {
      if (editingWorkoutId) {
        const workout = workouts.find((w) => w.id === editingWorkoutId);
        if (workout) await updateWorkout(workout, input);
      } else {
        await addWorkout(input);
      }
      resetWorkoutForm();
    } catch (err) {
      showAlert(editingWorkoutId ? "Couldn't save changes" : "Couldn't add workout", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setWorkoutSubmitting(false);
    }
  }

  function confirmDeleteWorkout(workout: Workout) {
    showAlert('Delete workout', `Remove "${workout.title}" and its exercises?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingWorkoutId === workout.id) resetWorkoutForm();
          deleteWorkout(workout).catch((err) => showAlert("Couldn't delete workout", err instanceof Error ? err.message : 'Something went wrong'));
        },
      },
    ]);
  }

  async function handleToggleWorkout(workout: Workout) {
    try {
      await toggleWorkout(workout);
    } catch (err) {
      showAlert("Couldn't update workout", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function resetExerciseForm() {
    setExerciseComposerWorkoutId(null);
    setEditingExerciseId(null);
    setExerciseName('');
    setTargetSets('');
    setTargetReps('');
    setTargetWeight('');
    setActualSets('');
    setActualReps('');
    setActualWeight('');
  }

  function openExerciseComposer(workoutId: string) {
    resetExerciseForm();
    setExerciseComposerWorkoutId(workoutId);
  }

  function startEditExercise(exercise: WorkoutExercise) {
    setExerciseComposerWorkoutId(exercise.workout_id);
    setEditingExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setTargetSets(exercise.target_sets ? String(exercise.target_sets) : '');
    setTargetReps(exercise.target_reps ? String(exercise.target_reps) : '');
    setTargetWeight(exercise.target_weight ? String(round1(Number(exercise.target_weight))) : '');
    setActualSets(exercise.last_actual_sets ? String(exercise.last_actual_sets) : '');
    setActualReps(exercise.last_actual_reps ? String(exercise.last_actual_reps) : '');
    setActualWeight(exercise.last_actual_weight ? String(round1(Number(exercise.last_actual_weight))) : '');
  }

  async function handleExerciseSubmit() {
    if (!exerciseComposerWorkoutId || !exerciseName.trim()) return;
    setExerciseSubmitting(true);
    try {
      const targetInput = {
        name: exerciseName,
        targetSets: targetSets.trim() ? Number(targetSets) : null,
        targetReps: targetReps.trim() ? Number(targetReps) : null,
        targetWeight: targetWeight.trim() ? parseDecimal(targetWeight) : null,
      };
      if (editingExerciseId) {
        const exercise = exercises.find((e) => e.id === editingExerciseId);
        if (exercise) {
          await updateExercise(exercise, targetInput);
          await updateExerciseActuals(exercise, {
            sets: actualSets.trim() ? Number(actualSets) : null,
            reps: actualReps.trim() ? Number(actualReps) : null,
            weight: actualWeight.trim() ? parseDecimal(actualWeight) : null,
          });
        }
      } else {
        const workoutExercises = exercisesByWorkout.get(exerciseComposerWorkoutId) ?? [];
        await addExercise(exerciseComposerWorkoutId, targetInput, workoutExercises.length);
      }
      resetExerciseForm();
    } catch (err) {
      showAlert(editingExerciseId ? "Couldn't save changes" : "Couldn't add exercise", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExerciseSubmitting(false);
    }
  }

  function confirmDeleteExercise(exercise: WorkoutExercise) {
    showAlert('Delete exercise', `Remove "${exercise.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingExerciseId === exercise.id) resetExerciseForm();
          deleteExercise(exercise).catch(() => showAlert("Couldn't delete exercise"));
        },
      },
    ]);
  }

  function buildWorkoutMeta(workout: Workout): string[] {
    const parts: string[] = [];
    if (workout.is_recurring) {
      parts.push(workout.day_of_week !== null ? WEEKDAY_SHORT[workout.day_of_week] : 'Weekly');
      const streak = formatWorkoutStreak(workout);
      if (streak) parts.push(streak);
      if (!isWorkoutDoneNow(workout)) {
        const lastDone = formatWorkoutLastDone(workout);
        if (lastDone) parts.push(lastDone);
      }
    } else if (workout.event_date && !workout.is_done) {
      const due = formatDueDate(workout.event_date);
      if (due) parts.push(due.text);
    }
    return parts;
  }

  function renderExerciseRow(exercise: WorkoutExercise) {
    const target = formatSetsRepsWeight(exercise.target_sets, exercise.target_reps, exercise.target_weight);
    const last = formatSetsRepsWeight(exercise.last_actual_sets, exercise.last_actual_reps, exercise.last_actual_weight);
    return (
      <View key={exercise.id} style={styles.exerciseRow}>
        <Pressable style={styles.exerciseTextWrapper} onPress={() => startEditExercise(exercise)}>
          {/* Nested under its workout, so it reads a step down from the
              workout title (which stays full-strength text) rather than
              competing with it at similar visual weight. */}
          <ThemedText type="smallBold" themeColor="textSecondary">
            {exercise.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {target ? `Target: ${target}` : 'No target set'}
            {last ? ` · Last: ${last}` : ''}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => confirmDeleteExercise(exercise)} hitSlop={8}>
          <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
            ×
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  function renderExerciseComposer() {
    return (
      <View style={styles.exerciseComposer}>
        <View style={styles.editingRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {editingExerciseId ? 'Edit exercise' : 'New exercise'}
          </ThemedText>
          <Pressable onPress={resetExerciseForm} hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Cancel
            </ThemedText>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="Exercise name"
          placeholderTextColor={theme.textSecondary}
          value={exerciseName}
          onChangeText={setExerciseName}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Target
        </ThemedText>
        <View style={styles.exerciseInputsRow}>
          <TextInput
            style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
            placeholder="Sets"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={targetSets}
            onChangeText={setTargetSets}
          />
          <TextInput
            style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
            placeholder="Reps"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={targetReps}
            onChangeText={setTargetReps}
          />
          <TextInput
            style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
            placeholder="kg"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={targetWeight}
            onChangeText={setTargetWeight}
          />
        </View>

        {editingExerciseId && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Last actual
            </ThemedText>
            <View style={styles.exerciseInputsRow}>
              <TextInput
                style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder="Sets"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={actualSets}
                onChangeText={setActualSets}
              />
              <TextInput
                style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder="Reps"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={actualReps}
                onChangeText={setActualReps}
              />
              <TextInput
                style={[styles.input, styles.exerciseInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder="kg"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={actualWeight}
                onChangeText={setActualWeight}
              />
            </View>
          </>
        )}

        <Pressable
          style={[styles.addButton, { backgroundColor: theme.accent, opacity: exerciseName.trim() && !exerciseSubmitting ? 1 : 0.5 }]}
          disabled={!exerciseName.trim() || exerciseSubmitting}
          onPress={handleExerciseSubmit}>
          <ThemedText type="smallBold" themeColor="background">
            {editingExerciseId ? 'Save changes' : 'Add exercise'}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  function renderWorkoutCard(workout: Workout) {
    const done = isWorkoutDoneNow(workout);
    const meta = buildWorkoutMeta(workout);
    const workoutExercises = exercisesByWorkout.get(workout.id) ?? [];

    return (
      <Animated.View key={workout.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(200)}>
        <ThemedView type="backgroundElement" style={[styles.workoutCard, editingWorkoutId === workout.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          <View style={styles.workoutHeaderRow}>
            <Checkbox checked={done} onToggle={() => handleToggleWorkout(workout)} />
            <Pressable style={styles.workoutTitleWrapper} onPress={() => startEditWorkout(workout)}>
              <ThemedText type="default" themeColor={done ? 'textSecondary' : 'text'} style={done && styles.doneText}>
                {workout.title}
              </ThemedText>
              {meta.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {meta.join(' · ')}
                </ThemedText>
              )}
            </Pressable>
            <Pressable onPress={() => confirmDeleteWorkout(workout)} hitSlop={8}>
              <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                ×
              </ThemedText>
            </Pressable>
          </View>

          {workoutExercises.length > 0 && (
            <View style={[styles.exerciseList, { backgroundColor: theme.backgroundSelected }]}>{workoutExercises.map(renderExerciseRow)}</View>
          )}

          {exerciseComposerWorkoutId === workout.id ? (
            renderExerciseComposer()
          ) : (
            <Pressable onPress={() => openExerciseComposer(workout.id)} style={styles.addLink} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                + Add exercise
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label="Health" onPress={onBack} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {composerOpen ? (
          <ThemedView type="backgroundElement" style={styles.addCard}>
            <View style={styles.editingRow}>
              <ThemedText type="smallBold">{editingWorkoutId ? 'Edit workout' : 'New workout'}</ThemedText>
              <Pressable onPress={resetWorkoutForm} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="e.g. Push Day, Leg Day…"
              placeholderTextColor={theme.textSecondary}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              autoFocus
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {(['recurring', 'oneoff'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setWorkoutIsRecurring(mode === 'recurring')}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.backgroundSelected },
                    (mode === 'recurring') === workoutIsRecurring && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText type="small" themeColor={(mode === 'recurring') === workoutIsRecurring ? 'background' : 'textSecondary'}>
                    {mode === 'recurring' ? 'Recurring weekly' : 'One-time'}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {workoutIsRecurring ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <Pressable
                    key={label}
                    onPress={() => setWorkoutDayOfWeek(i)}
                    style={[styles.pill, { backgroundColor: theme.backgroundSelected }, workoutDayOfWeek === i && { backgroundColor: theme.accent }]}>
                    <ThemedText type="small" themeColor={workoutDayOfWeek === i ? 'background' : 'textSecondary'}>
                      {WEEKDAY_SHORT[i]}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {EVENT_DATE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.label}
                    onPress={() => setWorkoutEventDate(opt.value)}
                    style={[styles.pill, { backgroundColor: theme.backgroundSelected }, workoutEventDate === opt.value && { backgroundColor: theme.accent }]}>
                    <ThemedText type="small" themeColor={workoutEventDate === opt.value ? 'background' : 'textSecondary'}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.textSecondary}
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
            />

            <Pressable
              style={[styles.addButton, { backgroundColor: theme.accent, opacity: workoutTitle.trim() && !workoutSubmitting ? 1 : 0.5 }]}
              disabled={!workoutTitle.trim() || workoutSubmitting}
              onPress={handleWorkoutSubmit}>
              <ThemedText type="smallBold" themeColor="background">
                {editingWorkoutId ? 'Save changes' : 'Add workout'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <Pressable
            onPress={() => {
              resetWorkoutForm();
              setComposerOpen(true);
            }}
            style={styles.addLink}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              + Add workout
            </ThemedText>
          </Pressable>
        )}

        {loading && workouts.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && visibleWorkouts.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            No workouts yet — add one above to start planning your training.
          </ThemedText>
        )}

        <View style={styles.workoutsColumn}>{visibleWorkouts.map(renderWorkoutCard)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  addCard: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  pillRow: { flexGrow: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  addLink: { paddingVertical: Spacing.one },
  loadingSpinner: { marginTop: Spacing.six },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.three },
  workoutsColumn: { gap: Spacing.three },
  workoutCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  workoutHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  workoutTitleWrapper: { flex: 1, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  exerciseList: { gap: Spacing.two, marginLeft: Spacing.five, marginTop: Spacing.one, padding: Spacing.two, borderRadius: Spacing.three },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  exerciseTextWrapper: { flex: 1, gap: Spacing.half },
  exerciseComposer: { gap: Spacing.two, paddingLeft: Spacing.five, marginTop: Spacing.one },
  exerciseInputsRow: { flexDirection: 'row', gap: Spacing.two },
  exerciseInput: { flex: 1, minWidth: 0 },
});
