import type { HouseholdMember } from '@/types/household';

// Simple linear leveling curve for v1 — 100 XP per level. Deliberately
// basic; the plan is to design the actual curve/rewards later once there's
// a real profile screen to build the fuller experience around.
const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export type XpProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0..1
};

/** How far into the current level someone is, for a progress bar. */
export function xpProgressForLevel(xp: number): XpProgress {
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return {
    level: levelForXp(xp),
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progress: xpIntoLevel / XP_PER_LEVEL,
  };
}

/** Household members ranked highest XP first — the leaderboard order. Ties
 * keep their existing relative order (whoever joined first stays ahead). */
export function sortMembersByXp(members: HouseholdMember[]): HouseholdMember[] {
  return [...members].sort((a, b) => (b.profile?.xp ?? 0) - (a.profile?.xp ?? 0));
}

/** A rank badge for a leaderboard position — medals for the top 3, a plain
 * "#N" after that. */
export function rankBadge(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? `#${index + 1}`;
}
