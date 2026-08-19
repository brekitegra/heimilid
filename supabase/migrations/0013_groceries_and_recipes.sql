-- ============================================================================
-- Groceries: lists (one "active" shopping list + saved reusable templates),
-- items (aisle-categorized), and pantry staples (one-tap add-all).
-- ============================================================================

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  -- Exactly one non-template ("active") list per household is the
  -- convention the app enforces at the query layer — the schema itself
  -- doesn't need a partial-unique constraint for this since it's always
  -- looked up by (household_id, is_template = false) and created lazily.
  is_template boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index grocery_lists_household_id_idx on public.grocery_lists (household_id);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists (id) on delete cascade,
  name text not null,
  quantity text,
  category text not null default 'other'
    check (category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'other')),
  is_checked boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index grocery_items_list_id_idx on public.grocery_items (list_id);

create table public.pantry_staples (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  category text not null default 'other'
    check (category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'other')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pantry_staples_household_id_idx on public.pantry_staples (household_id);

-- ============================================================================
-- Recipes: title/instructions + a flat ingredient list, each ingredient
-- optionally pre-categorized so "add to grocery list" lands items in the
-- right aisle group without the person having to re-categorize them.
-- ============================================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  instructions text,
  servings smallint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index recipes_household_id_idx on public.recipes (household_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  quantity text,
  category text
    check (category is null or category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'other')),
  created_at timestamptz not null default now()
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;
alter table public.pantry_staples enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Lists/staples/recipes are scoped directly by household_id, same
-- full-access-for-any-member policy shape as chores/pets/etc.
create policy "Household members manage grocery lists"
  on public.grocery_lists for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage pantry staples"
  on public.pantry_staples for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage recipes"
  on public.recipes for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Items/ingredients are scoped through their parent's household_id — same
-- indirection pattern as e.g. bills -> finance_accounts would need, just
-- via a subquery since there's no direct household_id column on these.
create policy "Household members manage grocery items"
  on public.grocery_items for all
  to authenticated
  using (exists (
    select 1 from public.grocery_lists l
    where l.id = grocery_items.list_id and public.is_household_member(l.household_id)
  ))
  with check (exists (
    select 1 from public.grocery_lists l
    where l.id = grocery_items.list_id and public.is_household_member(l.household_id)
  ));

create policy "Household members manage recipe ingredients"
  on public.recipe_ingredients for all
  to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)
  ));
