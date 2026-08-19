import type { GroceryCategory } from '@/types/grocery';

/** Display order matches how aisles are typically laid out in a store —
 * produce/dairy/meat near the walk, pantry/beverages/household in the
 * middle, "other" always last as a catch-all. */
export const GROCERY_CATEGORIES: { value: GroceryCategory; label: string; emoji: string }[] = [
  { value: 'produce', label: 'Produce', emoji: '🥬' },
  { value: 'dairy', label: 'Dairy', emoji: '🥛' },
  { value: 'meat', label: 'Meat', emoji: '🥩' },
  { value: 'bakery', label: 'Bakery', emoji: '🍞' },
  { value: 'frozen', label: 'Frozen', emoji: '🧊' },
  { value: 'pantry', label: 'Pantry', emoji: '🥫' },
  { value: 'beverages', label: 'Beverages', emoji: '🥤' },
  { value: 'household', label: 'Household', emoji: '🧹' },
  { value: 'pets', label: 'Pets', emoji: '🐾' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

const CATEGORY_ORDER = new Map(GROCERY_CATEGORIES.map((c, i) => [c.value, i]));

export function categoryLabel(category: GroceryCategory): string {
  return GROCERY_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other';
}

export function categoryEmoji(category: GroceryCategory): string {
  return GROCERY_CATEGORIES.find((c) => c.value === category)?.emoji ?? '📦';
}

export function categorySortIndex(category: GroceryCategory): number {
  return CATEGORY_ORDER.get(category) ?? CATEGORY_ORDER.size;
}

/** Groups a flat item list into ordered (category, items) buckets, aisle by
 * aisle, skipping any category with nothing in it. */
export function groupByCategory<T extends { category: GroceryCategory }>(items: T[]): { category: GroceryCategory; items: T[] }[] {
  const groups = new Map<GroceryCategory, T[]>();
  for (const item of items) {
    const bucket = groups.get(item.category);
    if (bucket) bucket.push(item);
    else groups.set(item.category, [item]);
  }
  return Array.from(groups.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => categorySortIndex(a.category) - categorySortIndex(b.category));
}
