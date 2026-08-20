/** Mirrors Practice's recurring-XOR-one-off shape exactly, minus any
 * assignee/completed_by concept — Health data is private per person, so
 * there's only ever one possible actor. */
export interface Workout {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  is_recurring: boolean;
  day_of_week: number | null;
  event_date: string | null;
  is_done: boolean;
  last_completed_at: string | null;
  streak_count: number;
  created_at: string;
}

export interface WorkoutInput {
  title: string;
  notes: string | null;
  isRecurring: boolean;
  dayOfWeek: number | null;
  eventDate: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  name: string;
  order_index: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  last_actual_sets: number | null;
  last_actual_reps: number | null;
  last_actual_weight: number | null;
  created_at: string;
}

export interface WorkoutExerciseInput {
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
}

/** What was actually done for one exercise, recorded when completing a
 * workout — keyed by exercise id so the completion form can be
 * pre-filled with each exercise's target/last values. */
export interface ExerciseActuals {
  sets: number | null;
  reps: number | null;
  weight: number | null;
}
