import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { PetCareTask, PetCareTaskInput } from '@/types/pet-care';

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

// Mirrors use-chores.tsx exactly — same recurrence model, same streak/XP
// conventions — just scoped to pet care tasks for a whole household instead
// of household-agnostic chores.

/** Whether a recurring care task's last completion still counts for "now" —
 * daily resets each day, weekly each ISO week, monthly each calendar
 * month, yearly each calendar year. `once` tasks ignore all of this and
 * just use their own persisted `is_done` flag. */
export function isPetCareDoneNow(task: PetCareTask, now = new Date()): boolean {
  if (task.frequency === 'once') return task.is_done;
  if (!task.last_completed_at) return false;

  const last = new Date(task.last_completed_at);
  switch (task.frequency) {
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

/** Whether a recurring care task's last completion falls in the period
 * immediately before the current one — i.e. completing it again now would
 * extend an unbroken streak rather than starting a new one. */
function wasCompletedInPreviousPeriod(task: PetCareTask, now = new Date()): boolean {
  if (task.frequency === 'once' || !task.last_completed_at) return false;
  const last = new Date(task.last_completed_at);

  switch (task.frequency) {
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

/** All pet care tasks for the household, across every pet — the section
 * component groups them by pet_id for display. */
export function usePetCare() {
  const { household, refresh: refreshHousehold } = useHousehold();
  const [tasks, setTasks] = useState<PetCareTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('pet_care_tasks')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setTasks((data ?? []) as PetCareTask[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addTask = useCallback(
    async (petId: string, input: PetCareTaskInput) => {
      if (!household) return;

      const { data, error } = await supabase
        .from('pet_care_tasks')
        .insert({
          household_id: household.id,
          pet_id: petId,
          title: input.title.trim(),
          frequency: input.frequency,
          assigned_to: input.assignedTo,
          due_date: input.dueDate,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setTasks((prev) => [...prev, data as PetCareTask]);
    },
    [household, currentUserId]
  );

  const updateTask = useCallback(async (task: PetCareTask, input: PetCareTaskInput) => {
    // Changing what a task even means (its frequency) invalidates whatever
    // "done for this period" / streak history it had.
    const frequencyChanged = input.frequency !== task.frequency;
    const patch = {
      title: input.title.trim(),
      frequency: input.frequency,
      assigned_to: input.assignedTo,
      due_date: input.dueDate,
      ...(frequencyChanged ? { last_completed_at: null, streak_count: 0, is_done: false, completed_by: null } : {}),
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from('pet_care_tasks').update(patch).eq('id', task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      throw error;
    }
  }, []);

  const toggleTask = useCallback(
    async (task: PetCareTask) => {
      const nowDone = !isPetCareDoneNow(task);
      let patch: Partial<PetCareTask>;
      // XP always goes to whoever actually checked the box, not whoever
      // the task happens to be assigned to — helping out earns it too.
      let xpDelta = 0;

      if (task.frequency === 'once') {
        patch = { is_done: nowDone, completed_by: nowDone ? currentUserId : null };
        xpDelta = nowDone ? XP_BASE : -XP_BASE;
      } else if (nowDone) {
        const continuesStreak = wasCompletedInPreviousPeriod(task);
        patch = {
          last_completed_at: new Date().toISOString(),
          streak_count: continuesStreak ? task.streak_count + 1 : 1,
          completed_by: currentUserId,
        };
        xpDelta = XP_BASE + (continuesStreak ? XP_STREAK_BONUS : 0);
      } else {
        // Undo: approximate rather than perfectly reconstruct history —
        // the streak bonus reverses if it looks like this completion had
        // one (streak was already 2+ before this undo).
        patch = { last_completed_at: null, streak_count: Math.max(0, task.streak_count - 1), completed_by: null };
        xpDelta = -(XP_BASE + (task.streak_count >= 2 ? XP_STREAK_BONUS : 0));
      }

      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from('pet_care_tasks').update(patch).eq('id', task.id);
      if (error) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        throw error;
      }

      // XP is a nice-to-have side effect — don't let a hiccup here undo the
      // task update that already succeeded.
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

  const deleteTask = useCallback(async (task: PetCareTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from('pet_care_tasks').delete().eq('id', task.id);
    if (error) {
      setTasks((prev) => [...prev, task].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    tasks,
    loading,
    currentUserId,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    refresh: load,
  };
}
