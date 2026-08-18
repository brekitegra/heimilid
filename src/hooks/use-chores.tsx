import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Chore, ChoreInput } from '@/types/chore';

const XP_BASE = 10;
const XP_STREAK_BONUS = 5;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whether a recurring chore's last completion still counts for "now" —
 * daily resets each day, weekly each ISO week, monthly each calendar
 * month, yearly each calendar year. `once` chores ignore all of this and
 * just use their own persisted `is_done` flag. */
export function isChoreDoneNow(chore: Chore, now = new Date()): boolean {
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

/** Whether a recurring chore's last completion falls in the period
 * immediately before the current one — i.e. completing it again now would
 * extend an unbroken streak rather than starting a new one. */
function wasCompletedInPreviousPeriod(chore: Chore, now = new Date()): boolean {
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

export function useChores() {
  const { household, refresh: refreshHousehold } = useHousehold();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      .from('chores')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else {
      setError(null);
      setChores((data ?? []) as Chore[]);
    }
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addChore = useCallback(
    async (input: ChoreInput) => {
      if (!household || !currentUserId) return;

      const { data, error } = await supabase
        .from('chores')
        .insert({
          household_id: household.id,
          title: input.title.trim(),
          frequency: input.frequency,
          assigned_to: input.assignedTo,
          due_date: input.dueDate,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setChores((prev) => [...prev, data as Chore]);
    },
    [household, currentUserId]
  );

  const updateChore = useCallback(async (chore: Chore, input: ChoreInput) => {
    // Changing what a chore even means (its frequency) invalidates
    // whatever "done for this period" / streak history it had.
    const frequencyChanged = input.frequency !== chore.frequency;
    const patch = {
      title: input.title.trim(),
      frequency: input.frequency,
      assigned_to: input.assignedTo,
      due_date: input.dueDate,
      ...(frequencyChanged ? { last_completed_at: null, streak_count: 0, is_done: false, completed_by: null } : {}),
    };

    setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from('chores').update(patch).eq('id', chore.id);
    if (error) {
      setChores((prev) => prev.map((c) => (c.id === chore.id ? chore : c)));
      throw error;
    }
  }, []);

  const toggleChore = useCallback(
    async (chore: Chore) => {
      const nowDone = !isChoreDoneNow(chore);
      let patch: Partial<Chore>;
      // XP always goes to whoever actually checked the box, not whoever
      // the chore happens to be assigned to — helping out earns it too.
      let xpDelta = 0;

      if (chore.frequency === 'once') {
        patch = { is_done: nowDone, completed_by: nowDone ? currentUserId : null };
        xpDelta = nowDone ? XP_BASE : -XP_BASE;
      } else if (nowDone) {
        const continuesStreak = wasCompletedInPreviousPeriod(chore);
        patch = {
          last_completed_at: new Date().toISOString(),
          streak_count: continuesStreak ? chore.streak_count + 1 : 1,
          completed_by: currentUserId,
        };
        xpDelta = XP_BASE + (continuesStreak ? XP_STREAK_BONUS : 0);
      } else {
        // Undo: approximate rather than perfectly reconstruct history —
        // the streak bonus reverses if it looks like this completion had
        // one (streak was already 2+ before this undo).
        patch = { last_completed_at: null, streak_count: Math.max(0, chore.streak_count - 1), completed_by: null };
        xpDelta = -(XP_BASE + (chore.streak_count >= 2 ? XP_STREAK_BONUS : 0));
      }

      setChores((prev) => prev.map((c) => (c.id === chore.id ? { ...c, ...patch } : c)));
      const { error } = await supabase.from('chores').update(patch).eq('id', chore.id);
      if (error) {
        setChores((prev) => prev.map((c) => (c.id === chore.id ? chore : c)));
        throw error;
      }

      // XP is a nice-to-have side effect — don't let a hiccup here undo the
      // chore update that already succeeded.
      const { error: xpError } = await supabase.rpc('award_xp', { amount: xpDelta });
      if (xpError) {
        console.warn('Failed to award XP:', xpError.message);
      } else {
        refreshHousehold();
      }

      return xpDelta;
    },
    [refreshHousehold, currentUserId]
  );

  const deleteChore = useCallback(async (chore: Chore) => {
    setChores((prev) => prev.filter((c) => c.id !== chore.id));
    const { error } = await supabase.from('chores').delete().eq('id', chore.id);
    if (error) {
      setChores((prev) => [...prev, chore].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    chores,
    loading,
    error,
    currentUserId,
    addChore,
    updateChore,
    toggleChore,
    deleteChore,
    refresh: load,
  };
}
