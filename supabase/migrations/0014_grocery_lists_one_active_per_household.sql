-- Enforces at the database level what the app relies on: at most one
-- non-template ("active") grocery list per household. Found via real
-- testing that the client-side lazy-create-if-missing check alone isn't
-- race-safe (two near-simultaneous loads can both see "none exists" and
-- both insert) — this constraint is the actual fix; the client just
-- needs to handle the resulting conflict gracefully.
create unique index grocery_lists_one_active_per_household
  on public.grocery_lists (household_id)
  where not is_template;
