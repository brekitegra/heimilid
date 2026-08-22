import type { KidChore, KidChoreFrequency } from '@/types/kid-chore';
import type { Language } from '@/hooks/use-language';

// Mirrors pet-care-format.ts exactly — same recurrence model, same date
// math — just typed against KidChore instead of PetCareTask. Same
// language-branching approach too — see chore-format.ts's doc comment.

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** "Last done today/yesterday/N days ago" for a recurring kid chore.
 * Returns null if it's never been completed. */
export function formatKidChoreLastDone(chore: KidChore, now = new Date(), language: Language = 'en'): string | null {
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

const STREAK_UNIT: Partial<Record<KidChoreFrequency, string>> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

const STREAK_UNIT_IS: Partial<Record<KidChoreFrequency, string>> = {
  daily: 'daga',
  weekly: 'vikna',
  monthly: 'mánaða',
  yearly: 'ára',
};

/** "3-day streak" once there's something worth bragging about (2+ in a
 * row). Returns null for `once` chores or a streak that hasn't started. */
export function formatKidChoreStreak(chore: KidChore, language: Language = 'en'): string | null {
  const unit = STREAK_UNIT[chore.frequency];
  if (!unit || chore.streak_count < 2) return null;
  if (language === 'is') return `${chore.streak_count} ${STREAK_UNIT_IS[chore.frequency]} runa`;
  return `${chore.streak_count}-${unit} streak`;
}
