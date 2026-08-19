import type { Practice } from '@/types/practice';

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Formats a Date as its own local calendar day (YYYY-MM-DD), never
 * converting through UTC first. `date.toISOString().slice(0, 10)` (used
 * elsewhere in the app for quick-pick due dates) shifts by a day right
 * around midnight in any timezone not exactly UTC — a risk worth avoiding
 * here specifically, since the calendar view would make an off-by-one-day
 * bug immediately and embarrassingly visible. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local-calendar-day-safe ISO date string N days from `from` (default
 * today) — see toLocalISODate for why this doesn't just use
 * `date.toISOString()` the way chore-format.ts's isoDateInDays does. */
export function localIsoDateInDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

/** Postgres `time` comes back as "16:00:00" — format as "4:00 PM". Returns
 * null for an unset time rather than a confusing empty string. */
export function formatTime12h(time: string | null): string | null {
  if (!time) return null;
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** "4:00–5:00 PM" when both are set, just one side if only one is, or null
 * if neither is. */
export function formatTimeRange(startTime: string | null, endTime: string | null): string | null {
  const start = formatTime12h(startTime);
  const end = formatTime12h(endTime);
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? null;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Last attended this week" caption for a recurring practice — mirrors
 * formatLastDone in chore-format.ts, weekly-only since day_of_week is
 * inherently a 7-day cycle. */
export function formatLastAttended(practice: Practice, now = new Date()): string | null {
  if (!practice.is_recurring || !practice.last_attended_at) return null;
  const last = new Date(practice.last_attended_at);
  if (startOfWeek(last).getTime() === startOfWeek(now).getTime()) return null; // already reads as "attended" this week
  const diffWeeks = Math.round((startOfWeek(now).getTime() - startOfWeek(last).getTime()) / (7 * 86_400_000));
  if (diffWeeks <= 1) return 'Last attended last week';
  return `Last attended ${diffWeeks} weeks ago`;
}

/** "3-week streak" once there's something worth bragging about (2+ in a
 * row). Returns null for one-off events or a streak that hasn't started. */
export function formatPracticeStreak(practice: Practice): string | null {
  if (!practice.is_recurring || practice.streak_count < 2) return null;
  return `${practice.streak_count}-week streak`;
}
