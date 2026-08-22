-- Simple household-shared notes — a basic shared notice board, not a
-- task/checklist. Household-shared like bills/chores (any real member
-- can add/edit/delete any note), not private-per-user — a note left for
-- the household to see is the whole point.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Household members manage notes"
  on public.notes for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
