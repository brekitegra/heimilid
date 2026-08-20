import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { MealPlan, MealPlanInput } from '@/types/meal-plan';

/** The household's planned dinners, across every date they've ever
 * planned (not scoped to "this week" — the section component filters to
 * whatever week is currently displayed). One row per date; assigning a
 * new meal to an already-planned date replaces it. */
export function useMealPlans() {
  const { household } = useHousehold();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', household.id)
      .order('plan_date', { ascending: true });

    if (!error) setPlans((data ?? []) as MealPlan[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Setting a meal is an occasional, deliberate action (not a rapid
  // toggle) — a plain refetch after the upsert is simpler than
  // reconciling optimistic local state, and there's no snappiness need
  // it would actually buy here.
  const setMeal = useCallback(
    async (input: MealPlanInput) => {
      if (!household) return;
      const { error } = await supabase.from('meal_plans').upsert(
        {
          household_id: household.id,
          plan_date: input.planDate,
          recipe_id: input.recipeId,
          title: input.title,
          created_by: currentUserId,
        },
        { onConflict: 'household_id,plan_date' }
      );
      if (error) throw error;
      await load();
    },
    [household, currentUserId, load]
  );

  const clearMeal = useCallback(async (plan: MealPlan) => {
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    const { error } = await supabase.from('meal_plans').delete().eq('id', plan.id);
    if (error) {
      setPlans((prev) => [...prev, plan].sort((a, b) => a.plan_date.localeCompare(b.plan_date)));
      throw error;
    }
  }, []);

  return {
    plans,
    loading,
    setMeal,
    clearMeal,
    refresh: load,
  };
}
