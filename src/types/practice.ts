/** A recurring weekly commitment (day_of_week set, event_date null) or a
 * one-off dated event (event_date set, day_of_week null) — never both,
 * enforced by a DB check constraint. Attendance tracking mirrors chores'
 * derived-streak model: recurring practices use last_attended_at/
 * streak_count (weekly-only, since day_of_week is inherently a 7-day
 * cycle); one-off events use the simpler is_done flag a "once" chore uses. */
export interface Practice {
  id: string;
  household_id: string;
  child_id: string | null;
  title: string;
  location: string | null;
  is_recurring: boolean;
  day_of_week: number | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  is_done: boolean;
  last_attended_at: string | null;
  streak_count: number;
  assigned_to: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PracticeInput {
  title: string;
  location: string | null;
  isRecurring: boolean;
  dayOfWeek: number | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  assignedTo: string | null;
}
