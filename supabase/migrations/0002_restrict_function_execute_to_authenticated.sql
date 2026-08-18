-- Supabase's default privileges grant EXECUTE on new functions directly to
-- anon/authenticated/service_role, separate from the PUBLIC pseudo-role
-- that 0001 revoked from. That left anon (unauthenticated) requests able to
-- call create_household / join_household / is_household_member /
-- handle_new_user over RPC. Lock them down to only the roles that need them.
--
-- How to apply: paste into the Supabase SQL editor for odwnrzasatbvwjxdbuqr,
-- or `supabase db push` once the CLI is linked.

-- Not meant to be called directly at all (trigger-only / internal helper).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon;
-- authenticated still needs is_household_member: RLS policies invoke it
-- under the querying session's role.
grant execute on function public.is_household_member(uuid) to authenticated;

-- Meant to be called by signed-in users only, never anon.
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
