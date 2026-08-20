export interface FoodLogEntry {
  id: string;
  user_id: string;
  logged_date: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: string;
}

export interface FoodLogEntryInput {
  loggedDate: string;
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface SavedFood {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: string;
}

export interface SavedFoodInput {
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}
