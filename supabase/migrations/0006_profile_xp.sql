-- Per-person XP, tracked on profiles so it's ready for a future profile
-- screen to read directly. Awarded via a function (not a raw client
-- UPDATE) so the increment is atomic and every user can only ever touch
-- their own row, regardless of who a completed chore was assigned to —
-- XP goes to whoever actually checked it off.
--
-- How to apply: paste into the Supabase SQL editor for odwnrzasatbvwjxdbuqr,
-- or `supabase db push` once the CLI is linked.

alter table public.profiles add column xp integer not null default 0;

create or replace function public.award_xp(amount integer)
returns void
language sql
security invoker
set search_path = public
as $$
  update profiles set xp = greatest(0, xp + amount) where id = auth.uid();
$$;

revoke execute on function public.award_xp(integer) from public, anon;
grant execute on function public.award_xp(integer) to authenticated;
