import type { ActivityLevel, Goal, Sex } from '@/types/health-profile';

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentary', hint: 'Little or no exercise' },
  { value: 'light', label: 'Light', hint: 'Exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderate', hint: 'Exercise 3–5 days/week' },
  { value: 'active', label: 'Active', hint: 'Exercise 6–7 days/week' },
  { value: 'very_active', label: 'Very active', hint: 'Physical job + training' },
];

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'cut', label: 'Cut', hint: '~20% calorie deficit' },
  { value: 'maintain', label: 'Maintain', hint: 'Match your TDEE' },
  { value: 'bulk', label: 'Bulk', hint: '~10% calorie surplus' },
];

const GOAL_MULTIPLIERS: Record<Goal, number> = {
  cut: 0.8,
  maintain: 1,
  bulk: 1.1,
};

/** Mifflin-St Jeor — the standard, well-validated BMR formula, more
 * accurate for most people than the older Harris-Benedict one. */
export function computeBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function computeTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

export type MacroTargets = { calorieTarget: number; proteinTargetG: number; fatTargetG: number; carbTargetG: number };

// Protein per kg of bodyweight, the midpoint of the commonly-cited range
// for each goal — deliberately *not* one flat ratio for every goal (an
// earlier version of this used a flat 1.8g/kg regardless of goal, which
// is within range for bulking but actually overshoots the recommended
// range for maintaining and sits at the low end for cutting):
//  - Bulk (1.6–2.2g/kg): a calorie surplus from carbs/fat already spares
//    protein, so you don't need the top of the range to grow muscle.
//  - Maintain (1.4–1.6g/kg): balanced energy means this lower baseline
//    is enough to maintain muscle and recover.
//  - Cut (1.6–2.4g/kg): needs to run higher than either of the above —
//    protein is what prevents muscle loss while in a calorie deficit,
//    and helps manage hunger.
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  cut: 2.0,
  maintain: 1.5,
  bulk: 1.9,
};

/** Suggested daily targets from a TDEE and goal. The result is shown
 * read-only in the UI (no hand-editing a single macro out of sync with
 * what these inputs would actually produce) — the only way to change a
 * target is to change age/weight/height/activity/goal above and tap
 * Calculate again. Protein is set relative to bodyweight (see
 * PROTEIN_G_PER_KG above, goal-dependent) rather than as a fixed share
 * of calories, since that's the macro people actually care about
 * hitting consistently; fat gets a fixed 25% of calories, and carbs
 * fill whatever's left. */
export function computeMacroTargets(tdee: number, goal: Goal, weightKg: number): MacroTargets {
  const calorieTarget = Math.round(tdee * GOAL_MULTIPLIERS[goal]);
  const proteinTargetG = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);
  const proteinCalories = proteinTargetG * 4;
  const fatCalories = calorieTarget * 0.25;
  const fatTargetG = Math.round(fatCalories / 9);
  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbTargetG = Math.round(remainingCalories / 4);
  return { calorieTarget, proteinTargetG, fatTargetG, carbTargetG };
}
