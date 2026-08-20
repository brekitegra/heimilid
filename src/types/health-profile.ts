export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';

export interface HealthProfile {
  id: string;
  user_id: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  sex: Sex | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  calorie_target: number | null;
  protein_target_g: number | null;
  fat_target_g: number | null;
  carb_target_g: number | null;
  updated_at: string;
}

export interface HealthProfileInput {
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  fatTargetG: number | null;
  carbTargetG: number | null;
}
