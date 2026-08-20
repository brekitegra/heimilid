-- Weekly dinner plan: one planned dinner per household per calendar date
-- (not a recurring weekly slot — a specific Monday can differ from the
-- next), optionally linked to a saved recipe (so "add this week's
-- ingredients to the list" has something to pull from) or just a
-- freeform meal name for nights that don't need one (takeout, leftovers).
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date date not null,
  recipe_id uuid references public.recipes (id) on delete set null,
  title text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Every planned dinner needs some way to describe itself, whether via a
  -- saved recipe or a typed-in name.
  constraint meal_plans_has_description check (recipe_id is not null or (title is not null and title <> ''))
);

-- One planned dinner per household per date — assigning a new one to an
-- already-planned date replaces it (upsert) rather than piling up.
create unique index meal_plans_one_per_household_date on public.meal_plans (household_id, plan_date);

create index meal_plans_recipe_id_idx on public.meal_plans (recipe_id);

alter table public.meal_plans enable row level security;

create policy "Household members manage meal plans"
  on public.meal_plans for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
