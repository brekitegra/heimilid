import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Bill, BillInput } from '@/types/bill';

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whether a recurring bill's last payment still counts for "now" —
 * daily resets each day, weekly each ISO week, monthly each calendar
 * month, yearly each calendar year. `once` bills ignore all of this and
 * just use their own persisted `is_paid` flag. Mirrors
 * use-chores.tsx's isChoreDoneNow exactly. */
export function isBillPaidNow(bill: Bill, now = new Date()): boolean {
  if (bill.frequency === 'once') return bill.is_paid;
  if (!bill.last_paid_at) return false;

  const last = new Date(bill.last_paid_at);
  switch (bill.frequency) {
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

/** Whether a recurring bill's last payment falls in the period
 * immediately before the current one — paying it again now would extend
 * an unbroken streak rather than starting a new one. */
function wasPaidInPreviousPeriod(bill: Bill, now = new Date()): boolean {
  if (bill.frequency === 'once' || !bill.last_paid_at) return false;
  const last = new Date(bill.last_paid_at);

  switch (bill.frequency) {
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

export function useBills() {
  const { household } = useHousehold();
  const [bills, setBills] = useState<Bill[]>([]);
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
      setBills([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else {
      setError(null);
      setBills((data ?? []) as Bill[]);
    }
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addBill = useCallback(
    async (input: BillInput) => {
      if (!household || !currentUserId) return;

      const { data, error } = await supabase
        .from('bills')
        .insert({
          household_id: household.id,
          name: input.name.trim(),
          amount: input.amount,
          account_id: input.accountId,
          due_day: input.dueDay,
          frequency: input.frequency,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setBills((prev) => [...prev, data as Bill]);
    },
    [household, currentUserId]
  );

  const updateBill = useCallback(async (bill: Bill, input: BillInput) => {
    // Changing what a bill even means (its frequency) invalidates
    // whatever "paid for this period" / streak history it had.
    const frequencyChanged = input.frequency !== bill.frequency;
    const patch = {
      name: input.name.trim(),
      amount: input.amount,
      account_id: input.accountId,
      due_day: input.dueDay,
      frequency: input.frequency,
      ...(frequencyChanged ? { last_paid_at: null, streak_count: 0, is_paid: false, paid_by: null } : {}),
    };

    setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, ...patch } : b)));
    const { error } = await supabase.from('bills').update(patch).eq('id', bill.id);
    if (error) {
      setBills((prev) => prev.map((b) => (b.id === bill.id ? bill : b)));
      throw error;
    }
  }, []);

  const toggleBill = useCallback(
    async (bill: Bill) => {
      const nowPaid = !isBillPaidNow(bill);
      let patch: Partial<Bill>;

      if (bill.frequency === 'once') {
        patch = { is_paid: nowPaid, paid_by: nowPaid ? currentUserId : null };
      } else if (nowPaid) {
        const continuesStreak = wasPaidInPreviousPeriod(bill);
        patch = {
          last_paid_at: new Date().toISOString(),
          streak_count: continuesStreak ? bill.streak_count + 1 : 1,
          paid_by: currentUserId,
        };
      } else {
        // Undo: approximate rather than perfectly reconstruct history.
        patch = { last_paid_at: null, streak_count: Math.max(0, bill.streak_count - 1), paid_by: null };
      }

      setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, ...patch } : b)));
      const { error } = await supabase.from('bills').update(patch).eq('id', bill.id);
      if (error) {
        setBills((prev) => prev.map((b) => (b.id === bill.id ? bill : b)));
        throw error;
      }
    },
    [currentUserId]
  );

  const deleteBill = useCallback(async (bill: Bill) => {
    setBills((prev) => prev.filter((b) => b.id !== bill.id));
    const { error } = await supabase.from('bills').delete().eq('id', bill.id);
    if (error) {
      setBills((prev) => [...prev, bill].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    bills,
    loading,
    error,
    addBill,
    updateBill,
    toggleBill,
    deleteBill,
    refresh: load,
  };
}
