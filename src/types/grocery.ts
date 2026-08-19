export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'frozen'
  | 'pantry'
  | 'beverages'
  | 'household'
  | 'pets'
  | 'other';

export interface GroceryList {
  id: string;
  household_id: string;
  name: string;
  is_template: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  is_checked: boolean;
  created_by: string | null;
  checked_by: string | null;
  created_at: string;
}

export interface GroceryItemInput {
  name: string;
  quantity: string | null;
  category: GroceryCategory;
}

export interface PantryStaple {
  id: string;
  household_id: string;
  name: string;
  category: GroceryCategory;
  created_by: string | null;
  created_at: string;
}
