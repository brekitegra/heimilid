-- Per-person monthly income, deliberately modeled like Health's tables
-- (private-per-user, auth.uid() = user_id) rather than bills/loans'
-- household-shared model — salary is more sensitive than "we have a
-- car insurance bill", and a household member shouldn't be forced to
-- reveal their exact income to see the household's combined leftover.
-- One row per (household, user) — a snapshot figure like Health's
-- profile targets, not a log; upserted in place when it changes.
--
-- NOTE: this private-per-user policy is superseded by migration 0033,
-- which the user asked to open income visibility up to real household
-- members (kids in this app never have their own login at all, so
-- there's no "kid" role to exclude here). Kept as its own migration
-- rather than rewritten in place, matching this project's convention of
-- preserving real fix history instead of squashing it.
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  monthly_amount numeric(12, 2) not null default 0 check (monthly_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

alter table public.incomes enable row level security;

create policy "Users manage their own income"
  on public.incomes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The only way to see the HOUSEHOLD total: a security-definer aggregate
-- that never returns individual rows, so a household member can see
-- "how much total income there is" without ever seeing what any other
-- specific member earns. Mirrors is_household_member()'s existing
-- SECURITY DEFINER shape/grants.
--
-- NOTE: dropped in migration 0033 once income visibility opened up to
-- all real household members, making this aggregate-only function
-- unnecessary — kept here for history rather than removed retroactively.
create or replace function public.household_total_income(target_household_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(monthly_amount), 0)
  from public.incomes
  where household_id = target_household_id
    and public.is_household_member(target_household_id);
$$;

revoke all on function public.household_total_income(uuid) from public;
grant execute on function public.household_total_income(uuid) to authenticated;
