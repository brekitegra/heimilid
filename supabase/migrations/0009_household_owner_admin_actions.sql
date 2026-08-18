-- Mirrors is_household_member's shape: a SECURITY DEFINER helper so the
-- household_members lookup inside these policies doesn't recurse into RLS
-- on itself, restricted to authenticated exactly like is_household_member.
create or replace function public.is_household_owner(target_household_id uuid)
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
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke execute on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated;

create policy "Owners can rename their household"
  on public.households for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

-- Complements the existing "Members can leave a household" self-delete
-- policy (kept as-is) — an owner can additionally remove someone else, but
-- not themselves via this path (they'd use "leave" for that, same as
-- anyone else, avoiding an owner accidentally self-removing here).
create policy "Owners can remove other members"
  on public.household_members for delete
  to authenticated
  using (public.is_household_owner(household_id) and user_id <> (select auth.uid()));
