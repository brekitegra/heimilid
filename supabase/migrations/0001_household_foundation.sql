-- Heimilið foundation schema: profiles, households, membership, and base
-- tables for chores / pets / finances / kids' practices.
--
-- How to apply: paste this whole file into the Supabase SQL editor for
-- your project (odwnrzasatbvwjxdbuqr) and run it. If you set up the
-- Supabase CLI later, `supabase db push` will pick this file up from
-- supabase/migrations/ instead.

create extension if not exists pgcrypto;

-- ============================================================================
-- profiles — one row per auth user, holds display info shown to housemates
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- households + membership
-- ============================================================================

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Helper used by every policy below. SECURITY DEFINER + a fixed search_path
-- lets it read household_members without re-triggering RLS on itself
-- (avoids infinite recursion in the household_members policies).
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

create policy "Members can view their household"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "Members can view their household roster"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "Members can leave a household"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Deliberately no INSERT policy on households / household_members: joining
-- or creating a household only happens through the two functions below, so
-- an invite code can't be brute-forced via a raw insert.

create or replace function public.create_household(household_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household public.households;
begin
  if trim(household_name) = '' then
    raise exception 'Household name cannot be empty';
  end if;

  insert into households (name, created_by)
  values (trim(household_name), auth.uid())
  returning * into new_household;

  insert into household_members (household_id, user_id, role)
  values (new_household.id, auth.uid(), 'owner');

  return new_household;
end;
$$;

create or replace function public.join_household(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.households;
begin
  select * into target from households where invite_code = upper(trim(code));

  if target.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into household_members (household_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return target;
end;
$$;

revoke execute on function public.create_household(text) from public;
revoke execute on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ============================================================================
-- Domain tables. Each is scoped to a household and every member of that
-- household can fully manage its rows (fine for a family app).
-- ============================================================================

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  notes text,
  assigned_to uuid references public.profiles (id) on delete set null,
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  due_date date,
  is_done boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  species text,
  breed text,
  birth_date date,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  account_type text not null default 'checking' check (account_type in ('checking', 'savings', 'credit', 'cash', 'other')),
  balance numeric(12, 2) not null default 0,
  currency text not null default 'ISK',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid references public.finance_accounts (id) on delete set null,
  name text not null,
  amount numeric(12, 2) not null,
  due_day smallint check (due_day between 1 and 31),
  is_recurring boolean not null default true,
  is_paid boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  birth_date date,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  child_id uuid references public.children (id) on delete cascade,
  title text not null,
  location text,
  day_of_week smallint check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.chores enable row level security;
alter table public.pets enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.bills enable row level security;
alter table public.children enable row level security;
alter table public.practices enable row level security;

create policy "Household members manage chores"
  on public.chores for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage pets"
  on public.pets for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage finance accounts"
  on public.finance_accounts for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage bills"
  on public.bills for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage children"
  on public.children for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Household members manage practices"
  on public.practices for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
