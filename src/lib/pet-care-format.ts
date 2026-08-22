import type { PetCareFrequency, PetCareTask } from '@/types/pet-care';
import type { Language } from '@/hooks/use-language';
import { formatMonthDay } from '@/lib/date-locale';

// Mirrors chore-format.ts exactly — same recurrence model, same date math —
// just typed against PetCareTask instead of Chore. Same language-branching
// approach too: these are plain functions with no hook access, so t()
// isn't available — see chore-format.ts's doc comment for why.

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** "Overdue" / "Due today" / "Due tomorrow" / "Due Jan 5" for a `once` care
 * task's due date. Returns null if there's no due date. */
export function formatCareDueDate(dueDate: string | null, now = new Date(), language: Language = 'en'): { text: string; overdue: boolean } | null {
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

/** "Last done today/yesterday/N days ago" for a recurring care task. Returns
 * null if it's never been completed. */
export function formatCareLastDone(task: PetCareTask, now = new Date(), language: Language = 'en'): string | null {
  if (task.frequency === 'once' || !task.last_completed_at) return null;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(task.last_completed_at)).getTime()) / MS_PER_DAY
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

const STREAK_UNIT: Partial<Record<PetCareFrequency, string>> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

const STREAK_UNIT_IS: Partial<Record<PetCareFrequency, string>> = {
  daily: 'daga',
  weekly: 'vikna',
  monthly: 'mánaða',
  yearly: 'ára',
};

/** "3-day streak" once there's something worth bragging about (2+ in a
 * row). Returns null for `once` tasks or a streak that hasn't started. */
export function formatCareStreak(task: PetCareTask, language: Language = 'en'): string | null {
  const unit = STREAK_UNIT[task.frequency];
  if (!unit || task.streak_count < 2) return null;
  if (language === 'is') return `${task.streak_count} ${STREAK_UNIT_IS[task.frequency]} runa`;
  return `${task.streak_count}-${unit} streak`;
}
