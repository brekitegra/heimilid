import type { Chore, ChoreFrequency } from '@/types/chore';
import type { Language } from '@/hooks/use-language';
import { formatMonthDay } from '@/lib/date-locale';

/** ISO date (YYYY-MM-DD, matching Postgres `date`) N days from today. */
export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** These captions are built by plain functions with no hook access (see
 * use-language.tsx's doc comment on useTranslation), so they take
 * `language` directly and branch internally rather than going through
 * t() — naive word-by-word substitution would produce broken Icelandic
 * grammar (case endings, word order) for a sentence like this. */

/** "Overdue" / "Due today" / "Due tomorrow" / "Due Jan 5" for a `once`
 * chore's due date. Returns null if there's no due date. */
export function formatDueDate(dueDate: string | null, now = new Date(), language: Language = 'en'): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = startOfDay(new Date(`${dueDate}T00:00:00`));
  const diffDays = Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

  if (language === 'is') {
    if (diffDays < 0) return { text: 'Of seint', overdue: true };
    if (diffDays === 0) return { text: 'Í dag', overdue: false };
    if (diffDays === 1) return { text: 'Á morgun', overdue: false };
    return { text: `Á ${formatMonthDay(due, language)}`, overdue: false };
  }
  if (diffDays < 0) return { text: 'Overdue', overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${formatMonthDay(due, language)}`, overdue: false };
}

/** "Last done today/yesterday/N days ago" for a recurring chore. Returns
 * null if it's never been completed. */
export function formatLastDone(chore: Chore, now = new Date(), language: Language = 'en'): string | null {
  if (chore.frequency === 'once' || !chore.last_completed_at) return null;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(chore.last_completed_at)).getTime()) / MS_PER_DAY
  );
  if (language === 'is') {
    if (diffDays <= 0) return 'Síðast lokið í dag';
    if (diffDays === 1) return 'Síðast lokið í gær';
    return `Síðast lokið fyrir ${diffDays} dögum`;
  }
  if (diffDays <= 0) return 'Last done today';
  if (diffDays === 1) return 'Last done yesterday';
  return `Last done ${diffDays} days ago`;
}

const STREAK_UNIT: Partial<Record<ChoreFrequency, string>> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

// Icelandic measure-compound genitive plurals ("6 vikna runa", "3 mánaða
// runa") — not a word-for-word translation of STREAK_UNIT's English
// singular nouns, since Icelandic uses a different case/number here.
const STREAK_UNIT_IS: Partial<Record<ChoreFrequency, string>> = {
  daily: 'daga',
  weekly: 'vikna',
  monthly: 'mánaða',
  yearly: 'ára',
};

/** "3-day streak" once there's something worth bragging about (2+ in a
 * row). Returns null for `once` chores or a streak that hasn't started. */
export function formatStreak(chore: Chore, language: Language = 'en'): string | null {
  const unit = STREAK_UNIT[chore.frequency];
  if (!unit || chore.streak_count < 2) return null;
  if (language === 'is') return `${chore.streak_count} ${STREAK_UNIT_IS[chore.frequency]} runa`;
  return `${chore.streak_count}-${unit} streak`;
}
