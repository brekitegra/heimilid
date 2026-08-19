-- Pet care: mirrors the chores table's shape exactly (same recurrence
-- model, same streak/completed_by/XP conventions) but scoped to a
-- specific pet instead of being pet-agnostic.
create table public.pet_care_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  title text not null,
  notes text,
  assigned_to uuid references public.profiles (id) on delete set null,
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly', 'monthly', 'yearly')),
  due_date date,
  is_done boolean not null default false,
  last_completed_at timestamptz,
  streak_count integer not null default 0,
  completed_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pet_care_tasks_pet_id_idx on public.pet_care_tasks (pet_id);
create index pet_care_tasks_household_id_idx on public.pet_care_tasks (household_id);

alter table public.pet_care_tasks enable row level security;

create policy "Household members manage pet care tasks"
  on public.pet_care_tasks for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Extend the grocery category taxonomy with Pets, across every table that
-- constrains it, so pet supplies show up properly grouped on the
-- existing household grocery list instead of needing a separate one.
alter table public.grocery_items drop constraint grocery_items_category_check;
alter table public.grocery_items add constraint grocery_items_category_check
  check (category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'pets', 'other'));

alter table public.pantry_staples drop constraint pantry_staples_category_check;
alter table public.pantry_staples add constraint pantry_staples_category_check
  check (category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'pets', 'other'));

alter table public.recipe_ingredients drop constraint recipe_ingredients_category_check;
alter table public.recipe_ingredients add constraint recipe_ingredients_category_check
  check (category is null or category in ('produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'household', 'pets', 'other'));
