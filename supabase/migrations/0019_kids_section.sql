-- Kids section: child profiles get a photo + star rewards (mirroring the
-- pets photo pattern), practices/activities extend to support both
-- recurring weekly slots and one-off events with attendance tracking that
-- mirrors chores' derived-streak model exactly, and a new school_items
-- table tracks tests/homework as a simple due-dated checklist (no
-- recurrence — a test doesn't repeat).

alter table public.children add column avatar_url text;
alter table public.children add column stars integer not null default 0;

alter table public.practices add column is_recurring boolean not null default true;
alter table public.practices add column event_date date;
alter table public.practices add column is_done boolean not null default false;
alter table public.practices add column last_attended_at timestamptz;
alter table public.practices add column streak_count integer not null default 0;
alter table public.practices add column completed_by uuid references public.profiles (id) on delete set null;

-- Recurring practices always carry a day_of_week and no event_date;
-- one-off events always carry an event_date and no day_of_week.
alter table public.practices add constraint practices_schedule_shape_check check (
  (is_recurring and day_of_week is not null and event_date is null)
  or (not is_recurring and event_date is not null and day_of_week is null)
);

create table public.school_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  title text not null,
  item_type text not null default 'homework' check (item_type in ('homework', 'test', 'quiz', 'project', 'other')),
  subject text,
  due_date date,
  is_done boolean not null default false,
  completed_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index school_items_child_id_idx on public.school_items (child_id);
create index school_items_household_id_idx on public.school_items (household_id);

alter table public.school_items enable row level security;

create policy "Household members manage school items"
  on public.school_items for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Stars: mirrors award_xp's minimal style exactly, but targets an
-- arbitrary child row rather than auth.uid()'s own — security invoker
-- means the UPDATE runs as the calling user, so the existing "Household
-- members manage children" RLS policy is what actually enforces that only
-- a real member of that child's household can move the needle (an
-- unauthorized call just silently affects 0 rows rather than needing a
-- separate explicit check here).
create or replace function public.award_child_stars(target_child_id uuid, amount integer)
returns void
language sql
security invoker
set search_path = public
as $$
  update children set stars = greatest(0, stars + amount) where id = target_child_id;
$$;

revoke execute on function public.award_child_stars(uuid, integer) from public, anon;
grant execute on function public.award_child_stars(uuid, integer) to authenticated;
