import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { ExerciseActuals, Workout, WorkoutExercise, WorkoutExerciseInput, WorkoutInput } from '@/types/workout';

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Mirrors use-chores.tsx's derived-streak model exactly — a recurring
// workout's "done" state is computed from last_completed_at, weekly-only
// (day_of_week is inherently a 7-day cycle, same as a practice). A
// one-off workout (is_recurring: false) just uses its own is_done flag.
//
// Deliberately simple for what "completing" means: the checkbox alone
// marks the session done (mirrors a chore exactly, no extra step) —
// logging *actual* sets/reps/weight per exercise is a separate,
// independently-editable action (updateExerciseActuals below), not
// gated behind completion. That keeps both interactions simple: "did I
// train today" is one tap, "what did I actually lift" is edited
// whenever you want, before/during/after marking the session done.

export function isWorkoutDoneNow(workout: Workout, now = new Date()): boolean {
  if (!workout.is_recurring) return workout.is_done;
  if (!workout.last_completed_at) return false;
  return startOfWeek(new Date(workout.last_completed_at)).getTime() === startOfWeek(now).getTime();
}

function wasCompletedInPreviousWeek(workout: Workout, now = new Date()): boolean {
  if (!workout.is_recurring || !workout.last_completed_at) return false;
  const previousWeekStart = startOfWeek(now);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  return startOfWeek(new Date(workout.last_completed_at)).getTime() === previousWeekStart.getTime();
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setWorkouts([]);
      setExercises([]);
      setLoading(false);
      return;
    }

    const { data: workoutRows, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!workoutError) setWorkouts((workoutRows ?? []) as Workout[]);

    const workoutIds = (workoutRows ?? []).map((w) => w.id);
    if (workoutIds.length > 0) {
      const { data: exerciseRows, error: exerciseError } = await supabase
        .from('workout_exercises')
        .select('*')
        .in('workout_id', workoutIds)
        .order('order_index', { ascending: true });
      if (!exerciseError) setExercises((exerciseRows ?? []) as WorkoutExercise[]);
    } else {
      setExercises([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount; load's own setState calls drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addWorkout = useCallback(
    async (input: WorkoutInput) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          title: input.title.trim(),
          notes: input.notes,
          is_recurring: input.isRecurring,
          day_of_week: input.isRecurring ? input.dayOfWeek : null,
          event_date: input.isRecurring ? null : input.eventDate,
        })
        .select()
        .single();

      if (error) throw error;
      setWorkouts((prev) => [...prev, data as Workout]);
      return data as Workout;
    },
    [userId]
  );

  const updateWorkout = useCallback(async (workout: Workout, input: WorkoutInput) => {
    const shapeChanged =
      input.isRecurring !== workout.is_recurring ||
      (input.isRecurring && input.dayOfWeek !== workout.day_of_week) ||
      (!input.isRecurring && input.eventDate !== workout.event_date);

    const patch = {
      title: input.title.trim(),
      notes: input.notes,
      is_recurring: input.isRecurring,
      day_of_week: input.isRecurring ? input.dayOfWeek : null,
      event_date: input.isRecurring ? null : input.eventDate,
      ...(shapeChanged ? { last_completed_at: null, streak_count: 0, is_done: false } : {}),
    };

    setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? { ...w, ...patch } : w)));
    const { error } = await supabase.from('workouts').update(patch).eq('id', workout.id);
    if (error) {
      setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? workout : w)));
      throw error;
    }
  }, []);

  const toggleWorkout = useCallback(async (workout: Workout) => {
    const nowDone = !isWorkoutDoneNow(workout);
    let patch: Partial<Workout>;

    if (!workout.is_recurring) {
      patch = { is_done: nowDone };
    } else if (nowDone) {
      const continuesStreak = wasCompletedInPreviousWeek(workout);
      patch = { last_completed_at: new Date().toISOString(), streak_count: continuesStreak ? workout.streak_count + 1 : 1 };
    } else {
      patch = { last_completed_at: null, streak_count: Math.max(0, workout.streak_count - 1) };
    }

    setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? { ...w, ...patch } : w)));
    const { error } = await supabase.from('workouts').update(patch).eq('id', workout.id);
    if (error) {
      setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? workout : w)));
      throw error;
    }
  }, []);

  const deleteWorkout = useCallback(async (workout: Workout) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
    setExercises((prev) => prev.filter((e) => e.workout_id !== workout.id));
    const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
    if (error) {
      setWorkouts((prev) => [...prev, workout].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  const addExercise = useCallback(async (workoutId: string, input: WorkoutExerciseInput, orderIndex: number) => {
    const { data, error } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        name: input.name.trim(),
        target_sets: input.targetSets,
        target_reps: input.targetReps,
        target_weight: input.targetWeight,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (error) throw error;
    setExercises((prev) => [...prev, data as WorkoutExercise]);
  }, []);

  const updateExercise = useCallback(async (exercise: WorkoutExercise, input: WorkoutExerciseInput) => {
    const patch = { name: input.name.trim(), target_sets: input.targetSets, target_reps: input.targetReps, target_weight: input.targetWeight };
    setExercises((prev) => prev.map((e) => (e.id === exercise.id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from('workout_exercises').update(patch).eq('id', exercise.id);
    if (error) {
      setExercises((prev) => prev.map((e) => (e.id === exercise.id ? exercise : e)));
      throw error;
    }
  }, []);

  // Recording actual performance is independent of the completion
  // checkbox — see the module-level comment on why.
  const updateExerciseActuals = useCallback(async (exercise: WorkoutExercise, actuals: ExerciseActuals) => {
    const patch = { last_actual_sets: actuals.sets, last_actual_reps: actuals.reps, last_actual_weight: actuals.weight };
    setExercises((prev) => prev.map((e) => (e.id === exercise.id ? { ...e, ...patch } : e)));
    const { error } = await supabase.from('workout_exercises').update(patch).eq('id', exercise.id);
    if (error) {
      setExercises((prev) => prev.map((e) => (e.id === exercise.id ? exercise : e)));
      throw error;
    }
  }, []);

  const deleteExercise = useCallback(async (exercise: WorkoutExercise) => {
    setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
    const { error } = await supabase.from('workout_exercises').delete().eq('id', exercise.id);
    if (error) {
      setExercises((prev) => [...prev, exercise].sort((a, b) => a.order_index - b.order_index));
      throw error;
    }
  }, []);

  return {
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
    refresh: load,
  };
}
