-- Wrap auth.uid() in a scalar subquery so Postgres evaluates it once per
-- query instead of re-evaluating it for every row (perf advisor flagged
-- these two policies as auth_rls_initplan).
--
-- How to apply: paste into the Supabase SQL editor for odwnrzasatbvwjxdbuqr,
-- or `supabase db push` once the CLI is linked.

drop policy "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "Members can leave a household" on public.household_members;
create policy "Members can leave a household"
  on public.household_members for delete
  to authenticated
  using (user_id = (select auth.uid()));
