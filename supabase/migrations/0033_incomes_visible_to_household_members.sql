-- Revised per the user's explicit call: real household members (the
-- adults using this app) should see each other's income — the privacy
-- boundary that actually matters here is against kids, and kids never
-- have their own login in this app at all (Kids is a non-auth,
-- household-owned data model — see `children`/`kid_chores`), so there's
-- no "kid" role to exclude at the RLS layer to begin with. Drops the
-- private-per-user policy and the now-unnecessary aggregate-only RPC in
-- favor of the same is_household_member() model bills/loans/savings
-- already use — just with writes still restricted to your own row (you
-- report your own salary; others can see it, not edit it).
drop policy "Users manage their own income" on public.incomes;

create policy "Household members can view incomes"
  on public.incomes for select to authenticated
  using (public.is_household_member(household_id));

create policy "Users manage their own income row"
  on public.incomes for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_household_member(household_id));

create policy "Users update their own income row"
  on public.incomes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own income row"
  on public.incomes for delete to authenticated
  using ((select auth.uid()) = user_id);

drop function if exists public.household_total_income(uuid);
