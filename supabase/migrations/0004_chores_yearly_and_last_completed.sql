-- Adds a 'yearly' frequency option, and a last_completed_at timestamp so
-- recurring chores can derive "done for the current period" (day/week/
-- month/year) instead of needing a scheduled job to reset a flag.
--
-- How to apply: paste into the Supabase SQL editor for odwnrzasatbvwjxdbuqr,
-- or `supabase db push` once the CLI is linked.

alter table public.chores
  drop constraint chores_frequency_check,
  add constraint chores_frequency_check
    check (frequency in ('once', 'daily', 'weekly', 'monthly', 'yearly'));

alter table public.chores add column last_completed_at timestamptz;
