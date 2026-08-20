-- Savings goals with custom milestones and a contribution log —
-- household-shared, like bills/loans (not private-per-user like Health).
--
-- Progress is a log of individual deposits (mirrors Health's food-log
-- pattern), not a single editable "current total" field like Loans'
-- principal — the running total is derived by summing contributions,
-- never stored directly, so it can never drift out of sync with its
-- own history.

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index savings_goals_household_id_idx on public.savings_goals (household_id);

alter table public.savings_goals enable row level security;

create policy "Household members manage savings goals"
  on public.savings_goals for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Custom, user-defined milestones (not auto percentage marks) — e.g.
-- "Flight tickets booked" at 150,000 kr. "Reached" is a derived
-- comparison against the goal's summed contributions, never stored.
create table public.savings_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  label text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index savings_milestones_goal_id_idx on public.savings_milestones (goal_id);

alter table public.savings_milestones enable row level security;

-- Scoped through the parent goal's household, same EXISTS pattern
-- workout_exercises uses through workouts (no household_id duplicated
-- on this table directly).
create policy "Household members manage savings milestones"
  on public.savings_milestones for all to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = savings_milestones.goal_id and public.is_household_member(g.household_id)))
  with check (exists (select 1 from public.savings_goals g where g.id = savings_milestones.goal_id and public.is_household_member(g.household_id)));

create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  contributed_at date not null default current_date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index savings_contributions_goal_id_idx on public.savings_contributions (goal_id);

alter table public.savings_contributions enable row level security;

create policy "Household members manage savings contributions"
  on public.savings_contributions for all to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = savings_contributions.goal_id and public.is_household_member(g.household_id)))
  with check (exists (select 1 from public.savings_goals g where g.id = savings_contributions.goal_id and public.is_household_member(g.household_id)));
