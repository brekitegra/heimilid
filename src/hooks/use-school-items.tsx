import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { SchoolItem, SchoolItemInput } from '@/types/school-item';

// A completed homework/test earns the child a flat star reward — no streak
// bonus, since these are one-off items that don't recur the way a chore or
// practice does.
const STARS_PER_ITEM = 2;

/** All school items (tests/homework) across every child in the household —
 * the section component groups them by child_id for display. Completing
 * one awards stars to the *child* (via the award_child_stars RPC), not XP
 * to the household member who checked it off — the child is who did the
 * homework, even though a parent's account is what's signed in. */
export function useSchoolItems() {
  const { household } = useHousehold();
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('school_items')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setItems((data ?? []) as SchoolItem[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addItem = useCallback(
    async (childId: string, input: SchoolItemInput) => {
      if (!household) return;
      const { data, error } = await supabase
        .from('school_items')
        .insert({
          household_id: household.id,
          child_id: childId,
          title: input.title.trim(),
          item_type: input.itemType,
          subject: input.subject,
          due_date: input.dueDate,
          assigned_to: input.assignedTo,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setItems((prev) => [...prev, data as SchoolItem]);
    },
    [household, currentUserId]
  );

  const updateItem = useCallback(async (item: SchoolItem, input: SchoolItemInput) => {
    const patch = {
      title: input.title.trim(),
      item_type: input.itemType,
      subject: input.subject,
      due_date: input.dueDate,
      assigned_to: input.assignedTo,
    };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from('school_items').update(patch).eq('id', item.id);
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      throw error;
    }
  }, []);

  const toggleItem = useCallback(
    async (item: SchoolItem) => {
      const nowDone = !item.is_done;
      const patch = { is_done: nowDone, completed_by: nowDone ? currentUserId : null };
      const starDelta = nowDone ? STARS_PER_ITEM : -STARS_PER_ITEM;

      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
      const { error } = await supabase.from('school_items').update(patch).eq('id', item.id);
      if (error) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        throw error;
      }

      // Stars are a nice-to-have side effect — don't let a hiccup here
      // undo the completion that already succeeded. Return 0 (not
      // starDelta) on failure so the caller never shows a star change —
      // popup or local count — that didn't actually happen.
      const { error: starError } = await supabase.rpc('award_child_stars', {
        target_child_id: item.child_id,
        amount: starDelta,
      });
      if (starError) {
        console.warn('Failed to award stars:', starError.message);
        return 0;
      }

      return starDelta;
    },
    [currentUserId]
  );

  const deleteItem = useCallback(async (item: SchoolItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase.from('school_items').delete().eq('id', item.id);
    if (error) {
      setItems((prev) => [...prev, item].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    items,
    loading,
    currentUserId,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
    refresh: load,
  };
}
