import type { PetCareFrequency, PetCareTask } from '@/types/pet-care';

// Mirrors chore-format.ts exactly — same recurrence model, same date math —
// just typed against PetCareTask instead of Chore.

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** "Overdue" / "Due today" / "Due tomorrow" / "Due Jan 5" for a `once` care
 * task's due date. Returns null if there's no due date. */
export function formatCareDueDate(dueDate: string | null, now = new Date()): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = startOfDay(new Date(`${dueDate}T00:00:00`));
  const diffDays = Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

  if (diffDays < 0) return { text: 'Overdue', overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: false };
}

/** "Last done today/yesterday/N days ago" for a recurring care task. Returns
 * null if it's never been completed. */
export function formatCareLastDone(task: PetCareTask, now = new Date()): string | null {
  if (task.frequency === 'once' || !task.last_completed_at) return null;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(task.last_completed_at)).getTime()) / MS_PER_DAY
  );
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

/** "3-day streak" once there's something worth bragging about (2+ in a
 * row). Returns null for `once` tasks or a streak that hasn't started. */
export function formatCareStreak(task: PetCareTask): string | null {
  const unit = STREAK_UNIT[task.frequency];
  if (!unit || task.streak_count < 2) return null;
  return `${task.streak_count}-${unit} streak`;
}
