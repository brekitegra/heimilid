-- Tracks consecutive on-time completions of a recurring chore (reset to 1
-- on completion after a gap, incremented when the immediately preceding
-- period was also completed, decremented on undo). Meaningless for 'once'
-- chores, always 0 there.
--
-- How to apply: paste into the Supabase SQL editor for odwnrzasatbvwjxdbuqr,
-- or `supabase db push` once the CLI is linked.

alter table public.chores add column streak_count integer not null default 0;
