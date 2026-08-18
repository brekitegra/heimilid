-- Owners can change another member's role (promote to co-owner). Multiple
-- owners can coexist deliberately — this is "promote", not a strict
-- single-owner "transfer" — so the household is never left ownerless just
-- because one owner steps away later.
create policy "Owners can change member roles"
  on public.household_members for update
  to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));
