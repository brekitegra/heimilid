-- Who checked an item off — same "helping out counts" attribution
-- already used for chores' completed_by.
alter table public.grocery_items
  add column checked_by uuid references public.profiles (id) on delete set null;

-- A simple meal-type tag for recipes, so a real recipe collection can be
-- filtered once it grows past a handful of entries.
alter table public.recipes
  add column category text not null default 'other'
    check (category in ('breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'other'));
