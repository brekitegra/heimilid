-- The Health tables' RLS policies called auth.uid() directly, which
-- Postgres re-evaluates per row instead of once per statement. Every other
-- RLS-protected table in this app goes through is_household_member()
-- (already wrapped correctly), so this pattern was new to Health and the
-- advisor caught it. Recreate each policy with (select auth.uid()), the
-- standard fix that lets the planner cache it as an InitPlan.

drop policy "Users manage their own health profile" on public.health_profiles;
create policy "Users manage their own health profile"
  on public.health_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "Users manage their own workouts" on public.workouts;
create policy "Users manage their own workouts" on public.workouts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "Users manage their own workout exercises" on public.workout_exercises;
create policy "Users manage their own workout exercises" on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())));

drop policy "Users manage their own saved foods" on public.saved_foods;
create policy "Users manage their own saved foods" on public.saved_foods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "Users manage their own food log" on public.food_log_entries;
create policy "Users manage their own food log" on public.food_log_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
