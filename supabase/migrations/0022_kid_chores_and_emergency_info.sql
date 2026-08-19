-- Kid chores/responsibilities: mirrors pet_care_tasks (itself mirroring
-- chores) exactly — same recurrence/streak model — but scoped to a child
-- and earning stars instead of XP. Specifically for children who don't
-- have (or don't yet have) their own household login; a kid old enough to
-- be a real household member already earns XP through the existing
-- Chores tab like any other member, so this is a separate, additive
-- concept rather than a replacement.
create table public.kid_chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
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

create index kid_chores_child_id_idx on public.kid_chores (child_id);
create index kid_chores_household_id_idx on public.kid_chores (household_id);

alter table public.kid_chores enable row level security;

create policy "Household members manage kid chores"
  on public.kid_chores for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Emergency/medical info: a dedicated, prominently-displayed field
-- separate from generic notes (allergies, doctor, emergency contact —
-- quick reference for anyone else caring for the kid, e.g. a babysitter).
alter table public.children add column emergency_info text;
