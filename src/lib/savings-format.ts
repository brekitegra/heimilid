import type { SavingsContribution, SavingsGoal } from '@/types/savings';
import type { Language } from '@/hooks/use-language';

/** A goal's running total is always derived by summing its
 * contributions — never stored directly, so it can't drift out of sync
 * with its own history. */
export function computeSavedTotal(goalId: string, contributions: SavingsContribution[]): number {
  return contributions.filter((c) => c.goal_id === goalId).reduce((sum, c) => sum + Number(c.amount), 0);
}

/** 0–1, capped — a goal that's been oversaved still reads as "100%
 * there", not 140%. */
export function computeProgress(goal: SavingsGoal, savedTotal: number): number {
  if (goal.target_amount <= 0) return 0;
  return Math.min(1, savedTotal / goal.target_amount);
}

/** "3 months to go" / "Target date passed" for a goal's optional target
 * date. Returns null if there's no target date set. Plain function, no
 * hook access — see chore-format.ts's doc comment — so it takes
 * `language` directly rather than going through t(). */
export function formatGoalDeadline(targetDate: string | null, now = new Date(), language: Language = 'en'): string | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (language === 'is') {
    if (diffDays < 0) return 'Markdagsetning liðin';
    if (diffDays === 0) return 'Markdagsetning er í dag';
    if (diffDays < 31) return `${diffDays} ${diffDays === 1 ? 'dagur' : 'dagar'} eftir`;
    const months = Math.round(diffDays / 30.44);
    return `${months} ${months === 1 ? 'mánuður' : 'mánuðir'} eftir`;
  }
  if (diffDays < 0) return 'Target date passed';
  if (diffDays === 0) return 'Target date is today';
  if (diffDays < 31) return `${diffDays} days to go`;
  const months = Math.round(diffDays / 30.44);
  return `${months} month${months === 1 ? '' : 's'} to go`;
}
