import type { Workout } from '@/types/workout';

// Mirrors pet-care-format.ts / kid-chore-format.ts exactly — same
// recurrence model, same date math — just typed against Workout, and
// weekly-only since day_of_week is inherently a 7-day cycle (a workout's
// recurring side is always "this day, every week", same as a practice).

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Last done this week/last week/N weeks ago" for a recurring workout.
 * Returns null if it's never been completed, or if it already reads as
 * done this week (nothing useful to add). */
export function formatWorkoutLastDone(workout: Workout, now = new Date()): string | null {
  if (!workout.is_recurring || !workout.last_completed_at) return null;
  const last = new Date(workout.last_completed_at);
  if (startOfWeek(last).getTime() === startOfWeek(now).getTime()) return null;
  const diffWeeks = Math.round((startOfWeek(now).getTime() - startOfWeek(last).getTime()) / (7 * 86_400_000));
  if (diffWeeks <= 1) return 'Last done last week';
  return `Last done ${diffWeeks} weeks ago`;
}

/** "3-week streak" once there's something worth bragging about (2+ in a
 * row). Returns null for one-off workouts or a streak that hasn't
 * started. */
export function formatWorkoutStreak(workout: Workout): string | null {
  if (!workout.is_recurring || workout.streak_count < 2) return null;
  return `${workout.streak_count}-week streak`;
}
