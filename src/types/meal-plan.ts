export interface MealPlan {
  id: string;
  household_id: string;
  plan_date: string;
  recipe_id: string | null;
  title: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** Exactly one of recipeId/title should be set — enforced by the DB check
 * constraint, not retyped here since either shape is valid input. */
export interface MealPlanInput {
  planDate: string;
  recipeId: string | null;
  title: string | null;
}
