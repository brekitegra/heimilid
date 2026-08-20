-- bills was provisioned in the very first migration with a bare
-- is_recurring/is_paid pair and no completion timestamp to derive "is
-- this paid *this* cycle" from — unlike every other recurring entity in
-- this app (chores/pet_care_tasks/kid_chores all have
-- last_completed_at/streak_count/completed_by). The table has never had
-- any hook or UI built against it (0 rows), so this is a free, safe
-- restructuring rather than a real migration of live data.
--
-- Mirrors chores exactly: frequency replaces the plain boolean (default
-- 'monthly' rather than chores' 'daily', since a mortgage/insurance/km-fee
-- actually recur monthly or yearly, not daily), plus last_paid_at/
-- streak_count/paid_by so recurring bills auto-reset to "unpaid" each
-- cycle instead of requiring a manual monthly uncheck.

alter table public.bills drop column is_recurring;

alter table public.bills add column frequency text not null default 'monthly'
  check (frequency in ('once', 'daily', 'weekly', 'monthly', 'yearly'));

alter table public.bills add column last_paid_at timestamptz;

alter table public.bills add column streak_count integer not null default 0;

-- Mirrors chores' completed_by: on delete set null (household-shared
-- attribution, not private ownership like Health's tables), so removing
-- an account doesn't touch the rest of the household's bill data.
alter table public.bills add column paid_by uuid references public.profiles (id) on delete set null;
