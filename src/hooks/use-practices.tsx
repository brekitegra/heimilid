import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Practice, PracticeInput } from '@/types/practice';

const STARS_BASE = 2;
const STARS_STREAK_BONUS = 1;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Mirrors use-chores.tsx's derived-streak model — a recurring practice's
// "attended" state is computed from last_attended_at, never a flag that
// needs resetting, weekly-only since day_of_week is inherently a 7-day
// cycle. A one-off event (is_recurring: false) just uses its own is_done
// flag, same as a "once" chore.

/** Whether a practice currently reads as "attended" — this week for a
 * recurring one, ever (its own is_done flag) for a one-off event. */
export function isPracticeAttended(practice: Practice, now = new Date()): boolean {
  if (!practice.is_recurring) return practice.is_done;
  if (!practice.last_attended_at) return false;
  return startOfWeek(new Date(practice.last_attended_at)).getTime() === startOfWeek(now).getTime();
}

/** Whether a recurring practice's last attendance falls in the week
 * immediately before the current one — attending again now would extend
 * an unbroken streak rather than starting a new one. */
function wasAttendedPreviousWeek(practice: Practice, now = new Date()): boolean {
  if (!practice.is_recurring || !practice.last_attended_at) return false;
  const previousWeekStart = startOfWeek(now);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  return startOfWeek(new Date(practice.last_attended_at)).getTime() === previousWeekStart.getTime();
}

/** All practices/events across every child in the household — the section
 * component groups them by child_id for display. */
export function usePractices() {
  const { household } = useHousehold();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setPractices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('practices')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setPractices((data ?? []) as Practice[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addPractice = useCallback(
    async (childId: string, input: PracticeInput) => {
      if (!household) return;
      const { data, error } = await supabase
        .from('practices')
        .insert({
          household_id: household.id,
          child_id: childId,
          title: input.title.trim(),
          location: input.location,
          is_recurring: input.isRecurring,
          day_of_week: input.isRecurring ? input.dayOfWeek : null,
          event_date: input.isRecurring ? null : input.eventDate,
          start_time: input.startTime,
          end_time: input.endTime,
          assigned_to: input.assignedTo,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setPractices((prev) => [...prev, data as Practice]);
    },
    [household, currentUserId]
  );

  const updatePractice = useCallback(async (practice: Practice, input: PracticeInput) => {
    // Switching between recurring/one-off (or which day/date) invalidates
    // whatever attendance history it had — same "changing what a chore
    // even means resets its progress" rule chores' updateChore uses.
    const shapeChanged =
      input.isRecurring !== practice.is_recurring ||
      (input.isRecurring && input.dayOfWeek !== practice.day_of_week) ||
      (!input.isRecurring && input.eventDate !== practice.event_date);

    const patch = {
      title: input.title.trim(),
      location: input.location,
      is_recurring: input.isRecurring,
      day_of_week: input.isRecurring ? input.dayOfWeek : null,
      event_date: input.isRecurring ? null : input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      assigned_to: input.assignedTo,
      ...(shapeChanged ? { last_attended_at: null, streak_count: 0, is_done: false, completed_by: null } : {}),
    };

    setPractices((prev) => prev.map((p) => (p.id === practice.id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from('practices').update(patch).eq('id', practice.id);
    if (error) {
      setPractices((prev) => prev.map((p) => (p.id === practice.id ? practice : p)));
      throw error;
    }
  }, []);

  const toggleAttended = useCallback(
    async (practice: Practice) => {
      const nowAttended = !isPracticeAttended(practice);
      let patch: Partial<Practice>;
      let starDelta = 0;

      if (!practice.is_recurring) {
        patch = { is_done: nowAttended, completed_by: nowAttended ? currentUserId : null };
        starDelta = nowAttended ? STARS_BASE : -STARS_BASE;
      } else if (nowAttended) {
        const continuesStreak = wasAttendedPreviousWeek(practice);
        patch = {
          last_attended_at: new Date().toISOString(),
          streak_count: continuesStreak ? practice.streak_count + 1 : 1,
          completed_by: currentUserId,
        };
        starDelta = STARS_BASE + (continuesStreak ? STARS_STREAK_BONUS : 0);
      } else {
        // Undo: approximate rather than perfectly reconstruct history —
        // mirrors chores' toggleChore undo.
        patch = { last_attended_at: null, streak_count: Math.max(0, practice.streak_count - 1), completed_by: null };
        starDelta = -(STARS_BASE + (practice.streak_count >= 2 ? STARS_STREAK_BONUS : 0));
      }

      setPractices((prev) => prev.map((p) => (p.id === practice.id ? { ...p, ...patch } : p)));
      const { error } = await supabase.from('practices').update(patch).eq('id', practice.id);
      if (error) {
        setPractices((prev) => prev.map((p) => (p.id === practice.id ? practice : p)));
        throw error;
      }

      if (!practice.child_id) return 0;

      // Return 0 (not starDelta) on failure so the caller never shows a
      // star change — popup or local count — that didn't actually happen.
      const { error: starError } = await supabase.rpc('award_child_stars', {
        target_child_id: practice.child_id,
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

  const deletePractice = useCallback(async (practice: Practice) => {
    setPractices((prev) => prev.filter((p) => p.id !== practice.id));
    const { error } = await supabase.from('practices').delete().eq('id', practice.id);
    if (error) {
      setPractices((prev) => [...prev, practice].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    practices,
    loading,
    currentUserId,
    addPractice,
    updatePractice,
    toggleAttended,
    deletePractice,
    refresh: load,
  };
}
