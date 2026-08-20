-- Supabase grants EXECUTE to `anon` directly by default (separate from
-- the `PUBLIC` pseudo-role) — the same gotcha migration 0002 already
-- fixed for the RPC functions from the very first migration. `revoke
-- ... from public` alone doesn't touch this; confirmed via
-- information_schema.routine_privileges, not just the advisors output.
--
-- NOTE: household_total_income itself is dropped in migration 0033 —
-- this fix is moot after that, but kept as its own migration for the
-- same real-history reason noted in 0031.
revoke execute on function public.household_total_income(uuid) from anon;
