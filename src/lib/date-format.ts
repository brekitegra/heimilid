// Generic local-date helpers shared across features (Kids' calendar,
// Groceries' meal plan) — pulled out of practice-format.ts once a second
// feature needed the exact same date math, rather than mirroring it a
// third time the way the recurrence-model helpers (chore-format.ts /
// pet-care-format.ts / kid-chore-format.ts) deliberately do.

/** Formats a Date as its own local calendar day (YYYY-MM-DD), never
 * converting through UTC first. `date.toISOString().slice(0, 10)` (used
 * elsewhere in the app for quick-pick due dates) shifts by a day right
 * around midnight in any timezone not exactly UTC — a risk worth avoiding
 * anywhere a real calendar/week grid makes an off-by-one-day bug
 * immediately and embarrassingly visible. */
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

/** Midnight Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}
