import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { FoodLogEntry, FoodLogEntryInput, SavedFood, SavedFoodInput } from '@/types/food-log';

/** The signed-in user's own food log and saved-foods library — private,
 * no household involved. Loads the full log (not date-scoped server
 * side) since the section component needs to browse different days;
 * fine at this scale, same approach every other hook in this app takes. */
export function useFoodLog() {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setEntries([]);
      setSavedFoods([]);
      setLoading(false);
      return;
    }

    const { data: entryRows, error: entryError } = await supabase
      .from('food_log_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!entryError) setEntries((entryRows ?? []) as FoodLogEntry[]);

    const { data: savedRows, error: savedError } = await supabase
      .from('saved_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!savedError) setSavedFoods((savedRows ?? []) as SavedFood[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount; load's own setState calls drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addEntry = useCallback(
    async (input: FoodLogEntryInput) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('food_log_entries')
        .insert({
          user_id: userId,
          logged_date: input.loggedDate,
          name: input.name.trim(),
          calories: input.calories,
          protein_g: input.proteinG,
          fat_g: input.fatG,
          carbs_g: input.carbsG,
        })
        .select()
        .single();

      if (error) throw error;
      setEntries((prev) => [...prev, data as FoodLogEntry]);
    },
    [userId]
  );

  const updateEntry = useCallback(async (entry: FoodLogEntry, input: FoodLogEntryInput) => {
    const previous = entry;
    const optimistic: FoodLogEntry = {
      ...entry,
      logged_date: input.loggedDate,
      name: input.name.trim(),
      calories: input.calories,
      protein_g: input.proteinG,
      fat_g: input.fatG,
      carbs_g: input.carbsG,
    };
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? optimistic : e)));
    const { error } = await supabase
      .from('food_log_entries')
      .update({
        logged_date: input.loggedDate,
        name: input.name.trim(),
        calories: input.calories,
        protein_g: input.proteinG,
        fat_g: input.fatG,
        carbs_g: input.carbsG,
      })
      .eq('id', entry.id);
    if (error) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? previous : e)));
      throw error;
    }
  }, []);

  const deleteEntry = useCallback(async (entry: FoodLogEntry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    const { error } = await supabase.from('food_log_entries').delete().eq('id', entry.id);
    if (error) {
      setEntries((prev) => [...prev, entry]);
      throw error;
    }
  }, []);

  const addSavedFood = useCallback(
    async (input: SavedFoodInput) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('saved_foods')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          calories: input.calories,
          protein_g: input.proteinG,
          fat_g: input.fatG,
          carbs_g: input.carbsG,
        })
        .select()
        .single();

      if (error) throw error;
      setSavedFoods((prev) => [...prev, data as SavedFood]);
    },
    [userId]
  );

  const deleteSavedFood = useCallback(async (food: SavedFood) => {
    setSavedFoods((prev) => prev.filter((f) => f.id !== food.id));
    const { error } = await supabase.from('saved_foods').delete().eq('id', food.id);
    if (error) {
      setSavedFoods((prev) => [...prev, food]);
      throw error;
    }
  }, []);

  // Quick re-log of a saved food onto a given day — a fresh independent
  // log entry (copies the macros at save-time), not linked back to the
  // saved food, so editing/deleting the saved food later never rewrites
  // history.
  const logSavedFood = useCallback(
    (food: SavedFood, loggedDate: string) =>
      addEntry({ loggedDate, name: food.name, calories: food.calories, proteinG: food.protein_g, fatG: food.fat_g, carbsG: food.carbs_g }),
    [addEntry]
  );

  return {
    entries,
    savedFoods,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    addSavedFood,
    deleteSavedFood,
    logSavedFood,
    refresh: load,
  };
}
