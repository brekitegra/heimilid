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

/** Suggested daily targets from a TDEE and goal — purely a starting
 * point, every field stays freely editable afterward (a "Recalculate"
 * just re-derives them, it doesn't lock anything in). Protein is set
 * relative to bodyweight (a standard ~1.8g/kg for maintaining/building
 * muscle) rather than as a fixed share of calories, since that's the
 * macro people actually care about hitting consistently; fat gets a
 * fixed 25% of calories, and carbs fill whatever's left. */
export function computeMacroTargets(tdee: number, goal: Goal, weightKg: number): MacroTargets {
  const calorieTarget = Math.round(tdee * GOAL_MULTIPLIERS[goal]);
  const proteinTargetG = Math.round(weightKg * 1.8);
  const proteinCalories = proteinTargetG * 4;
  const fatCalories = calorieTarget * 0.25;
  const fatTargetG = Math.round(fatCalories / 9);
  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbTargetG = Math.round(remainingCalories / 4);
  return { calorieTarget, proteinTargetG, fatTargetG, carbTargetG };
}
