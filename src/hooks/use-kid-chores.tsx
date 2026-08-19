import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { KidChore, KidChoreInput } from '@/types/kid-chore';

const STARS_BASE = 2;
const STARS_STREAK_BONUS = 1;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Mirrors use-pet-care.tsx (itself mirroring use-chores.tsx) exactly —
// same recurrence model, same streak/completed_by conventions — just
// scoped to a child and awarding stars instead of XP. For children who
// don't have their own household login; a kid old enough to be a real
// member already earns XP through the existing Chores tab.

/** Whether a recurring kid chore's last completion still counts for "now"
 * — daily resets each day, weekly each ISO week, monthly each calendar
 * month, yearly each calendar year. `once` chores ignore all of this and
 * just use their own persisted `is_done` flag. */
export function isKidChoreDoneNow(chore: KidChore, now = new Date()): boolean {
  if (chore.frequency === 'once') return chore.is_done;
  if (!chore.last_completed_at) return false;

  const last = new Date(chore.last_completed_at);
  switch (chore.frequency) {
    case 'daily':
      return last.toDateString() === now.toDateString();
    case 'weekly':
      return startOfWeek(last).getTime() === startOfWeek(now).getTime();
    case 'monthly':
      return last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth();
    case 'yearly':
      return last.getFullYear() === now.getFullYear();
  }
}

function wasCompletedInPreviousPeriod(chore: KidChore, now = new Date()): boolean {
  if (chore.frequency === 'once' || !chore.last_completed_at) return false;
  const last = new Date(chore.last_completed_at);

  switch (chore.frequency) {
    case 'daily': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return last.toDateString() === yesterday.toDateString();
    }
    case 'weekly': {
      const previousWeekStart = startOfWeek(now);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      return startOfWeek(last).getTime() === previousWeekStart.getTime();
    }
    case 'monthly': {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return last.getFullYear() === previousMonth.getFullYear() && last.getMonth() === previousMonth.getMonth();
    }
    case 'yearly':
      return last.getFullYear() === now.getFullYear() - 1;
  }
}

/** All kid chores across every child in the household — the section
 * component groups them by child_id for display. */
export function useKidChores() {
  const { household } = useHousehold();
  const [chores, setChores] = useState<KidChore[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setChores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('kid_chores')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setChores((data ?? []) as KidChore[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addChore = useCallback(
    async (childId: string, input: KidChoreInput) => {
      if (!household) return;
      const { data, error } = await supabase
        .from('kid_chores')
        .insert({
          household_id: household.id,
          child_id: childId,
          title: input.title.trim(),
          frequency: input.frequency,
          due_date: input.dueDate,
          assigned_to: input.assignedTo,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setChores((prev) => [...prev, data as KidChore]);
    },
    [household, currentUserId]
  );

  const updateChore = useCallback(async (chore: KidChore, input: KidChoreInput) => {
    const frequencyChanged = input.frequency !== chore.frequency;
    const patch = {
      title: input.title.trim(),
      frequency: input.frequency,
      due_date: input.dueDate,
      assigned_to: input.assignedTo,
      ...(frequencyChanged ? { last_completed_at: null, streak_count: 0, is_done: false, completed_by: null } : {}),
    };

    setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from('kid_chores').update(patch).eq('id', chore.id);
    if (error) {
      setChores((prev) => prev.map((c) => (c.id === chore.id ? chore : c)));
      throw error;
    }
  }, []);

  const toggleChore = useCallback(
    async (chore: KidChore) => {
      const nowDone = !isKidChoreDoneNow(chore);
      let patch: Partial<KidChore>;
      let starDelta = 0;

      if (chore.frequency === 'once') {
        patch = { is_done: nowDone, completed_by: nowDone ? currentUserId : null };
        starDelta = nowDone ? STARS_BASE : -STARS_BASE;
      } else if (nowDone) {
        const continuesStreak = wasCompletedInPreviousPeriod(chore);
        patch = {
          last_completed_at: new Date().toISOString(),
          streak_count: continuesStreak ? chore.streak_count + 1 : 1,
          completed_by: currentUserId,
        };
        starDelta = STARS_BASE + (continuesStreak ? STARS_STREAK_BONUS : 0);
      } else {
        patch = { last_completed_at: null, streak_count: Math.max(0, chore.streak_count - 1), completed_by: null };
        starDelta = -(STARS_BASE + (chore.streak_count >= 2 ? STARS_STREAK_BONUS : 0));
      }

      setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)));
      const { error } = await supabase.from('kid_chores').update(patch).eq('id', chore.id);
      if (error) {
        setChores((prev) => prev.map((c) => (c.id === chore.id ? chore : c)));
        throw error;
      }

      // Return 0 (not starDelta) on failure so the caller never shows a
      // star change — popup or local count — that didn't actually happen.
      const { error: starError } = await supabase.rpc('award_child_stars', {
        target_child_id: chore.child_id,
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

  const deleteChore = useCallback(async (chore: KidChore) => {
    setChores((prev) => prev.filter((c) => c.id !== chore.id));
    const { error } = await supabase.from('kid_chores').delete().eq('id', chore.id);
    if (error) {
      setChores((prev) => [...prev, chore].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    chores,
    loading,
    currentUserId,
    addChore,
    updateChore,
    toggleChore,
    deleteChore,
    refresh: load,
  };
}
