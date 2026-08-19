import type { GroceryCategory } from '@/types/grocery';

export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack' | 'other';

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  category: GroceryCategory | null;
  created_at: string;
}

export interface RecipeIngredientInput {
  name: string;
  quantity: string | null;
  category: GroceryCategory | null;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  instructions: string | null;
  servings: number | null;
  category: RecipeCategory;
  created_by: string | null;
  created_at: string;
  ingredients?: RecipeIngredient[];
}

export interface RecipeInput {
  title: string;
  instructions: string | null;
  servings: number | null;
  category: RecipeCategory;
  ingredients: RecipeIngredientInput[];
}
