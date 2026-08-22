import { startOfWeek } from '@/lib/date-format';
import type { Practice } from '@/types/practice';
import type { Language } from '@/hooks/use-language';

// Re-exported so existing imports of these from practice-format.ts (there
// before a second feature needed the same date math) keep working
// unchanged — see date-format.ts for the actual definitions.
export { localIsoDateInDays, toLocalISODate } from '@/lib/date-format';

// Kept as English identifiers deliberately — kids-section.tsx uses these
// only for day-of-week indexing now, not for display (it builds its own
// translated array from the weekdayShortMon..Sun / weekdayMonday..Sunday
// keys in translations.ts for anything the user actually sees).
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Postgres `time` comes back as "16:00:00" — format as "4:00 PM" (or
 * "16:00" for Icelandic, which conventionally uses 24-hour time rather
 * than "f.h./e.h."). Returns null for an unset time rather than a
 * confusing empty string. Plain function, no hook access — see
 * chore-format.ts's doc comment — so it takes `language` directly. */
export function formatTime12h(time: string | null, language: Language = 'en'): string | null {
  if (!time) return null;
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (language === 'is') return `${hour}:${String(minute).padStart(2, '0')}`;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** "4:00–5:00 PM" when both are set, just one side if only one is, or null
 * if neither is. */
export function formatTimeRange(startTime: string | null, endTime: string | null, language: Language = 'en'): string | null {
  const start = formatTime12h(startTime, language);
  const end = formatTime12h(endTime, language);
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? null;
}

/** "Last attended this week" caption for a recurring practice — mirrors
 * formatLastDone in chore-format.ts, weekly-only since day_of_week is
 * inherently a 7-day cycle. */
export function formatLastAttended(practice: Practice, now = new Date(), language: Language = 'en'): string | null {
  if (!practice.is_recurring || !practice.last_attended_at) return null;
  const last = new Date(practice.last_attended_at);
  if (startOfWeek(last).getTime() === startOfWeek(now).getTime()) return null; // already reads as "attended" this week
  const diffWeeks = Math.round((startOfWeek(now).getTime() - startOfWeek(last).getTime()) / (7 * 86_400_000));
  if (language === 'is') {
    if (diffWeeks <= 1) return 'Síðast mætt í síðustu viku';
    return `Síðast mætt fyrir ${diffWeeks} vikum`;
  }
  if (diffWeeks <= 1) return 'Last attended last week';
  return `Last attended ${diffWeeks} weeks ago`;
}

/** "3-week streak" once there's something worth bragging about (2+ in a
 * row). Returns null for one-off events or a streak that hasn't started. */
export function formatPracticeStreak(practice: Practice, language: Language = 'en'): string | null {
  if (!practice.is_recurring || practice.streak_count < 2) return null;
  if (language === 'is') return `${practice.streak_count} vikna runa`;
  return `${practice.streak_count}-week streak`;
}
