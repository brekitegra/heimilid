import type { SavingsContribution, SavingsGoal, SavingsMilestone } from '@/types/savings';

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

/** Whether a custom milestone has been reached by the goal's current
 * saved total — derived, never stored. */
export function isMilestoneReached(milestone: SavingsMilestone, savedTotal: number): boolean {
  return savedTotal >= milestone.target_amount;
}

/** "3 months to go" / "Target date passed" for a goal's optional target
 * date. Returns null if there's no target date set. */
export function formatGoalDeadline(targetDate: string | null, now = new Date()): string | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 'Target date passed';
  if (diffDays === 0) return 'Target date is today';
  if (diffDays < 31) return `${diffDays} days to go`;
  const months = Math.round(diffDays / 30.44);
  return `${months} month${months === 1 ? '' : 's'} to go`;
}
