import type { RecipeCategory } from '@/types/recipe';

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'snack', label: 'Snack' },
  { value: 'other', label: 'Other' },
];

export function recipeCategoryLabel(category: RecipeCategory): string {
  return RECIPE_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other';
}
