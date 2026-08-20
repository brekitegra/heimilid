-- Health & fitness: unlike every other feature in this app, this data is
-- private to each person rather than shared across the household — body
-- stats, training, and food intake are more sensitive than chores or
-- groceries. RLS here is auth.uid() = user_id directly; no household_id
-- or is_household_member anywhere in this migration.
--
-- created_by/completed_by-style attribution columns don't apply either —
-- there's only ever one possible actor (the row's own owner), so plain
-- user_id ownership is enough. For the same reason, on delete here is
-- CASCADE, not this app's usual SET NULL: if someone deletes their
-- account, their private health data has no one left who could ever see
-- or want it, unlike household-shared rows whose deletion would affect
-- other real people still in that household.

-- One row per person — their body stats, TDEE inputs, and the resulting
-- (but freely editable) daily targets.
create table public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  age integer,
  weight_kg numeric(5, 2),
  height_cm numeric(5, 2),
  sex text check (sex in ('male', 'female')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('cut', 'maintain', 'bulk')),
  calorie_target integer,
  protein_target_g integer,
  fat_target_g integer,
  carb_target_g integer,
  updated_at timestamptz not null default now()
);

alter table public.health_profiles enable row level security;

create policy "Users manage their own health profile"
  on public.health_profiles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A planned workout — mirrors practices' recurring-XOR-one-off shape and
-- chores' streak/completion model, just without any assignee/completed_by
-- concept (there's only ever one possible person: the owner).
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  notes text,
  is_recurring boolean not null default true,
  day_of_week smallint check (day_of_week between 0 and 6),
  event_date date,
  is_done boolean not null default false,
  last_completed_at timestamptz,
  streak_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint workouts_schedule_shape_check check (
    (is_recurring and day_of_week is not null and event_date is null)
    or (not is_recurring and event_date is not null and day_of_week is null)
  )
);

create index workouts_user_id_idx on public.workouts (user_id);
alter table public.workouts enable row level security;

create policy "Users manage their own workouts"
  on public.workouts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The planned exercise list for a workout, plus the most recently logged
-- actual performance (updated in place each time the workout is
-- completed) — a single "last time" snapshot rather than a full history
-- table, mirroring how last_completed_at itself works.
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  target_sets integer,
  target_reps integer,
  target_weight numeric(6, 2),
  last_actual_sets integer,
  last_actual_reps integer,
  last_actual_weight numeric(6, 2),
  created_at timestamptz not null default now()
);

create index workout_exercises_workout_id_idx on public.workout_exercises (workout_id);
alter table public.workout_exercises enable row level security;

create policy "Users manage their own workout exercises"
  on public.workout_exercises for all
  to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid()));

-- A personal library of frequently-eaten foods, for quick re-logging —
-- mirrors pantry_staples' role for Groceries.
create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  calories integer not null default 0,
  protein_g numeric(6, 2) not null default 0,
  fat_g numeric(6, 2) not null default 0,
  carbs_g numeric(6, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index saved_foods_user_id_idx on public.saved_foods (user_id);
alter table public.saved_foods enable row level security;

create policy "Users manage their own saved foods"
  on public.saved_foods for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- What was actually eaten on a given day.
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_date date not null,
  name text not null,
  calories integer not null default 0,
  protein_g numeric(6, 2) not null default 0,
  fat_g numeric(6, 2) not null default 0,
  carbs_g numeric(6, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index food_log_entries_user_date_idx on public.food_log_entries (user_id, logged_date);
alter table public.food_log_entries enable row level security;

create policy "Users manage their own food log"
  on public.food_log_entries for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
