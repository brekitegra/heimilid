import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Income } from '@/types/income';

/** Household-shared, like bills/loans — any real household member can
 * see everyone's income (the privacy boundary that actually matters
 * here is against kids, and kids never have their own login in this
 * app at all, so there's no "kid" role to exclude at the RLS layer).
 * Writes stay restricted to your own row via RLS (you report your own
 * salary; others can see it, not edit it). */
export function useIncome() {
  const { household } = useHousehold();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIncome, setSavingIncome] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!household) {
      setIncomes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data, error } = await supabase.from('incomes').select('*').eq('household_id', household.id);
    if (!error) setIncomes((data ?? []) as Income[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setMonthlyIncome = useCallback(
    async (monthlyAmount: number) => {
      if (!household || !userId) return;
      setSavingIncome(true);
      try {
        const { data, error } = await supabase
          .from('incomes')
          .upsert(
            { household_id: household.id, user_id: userId, monthly_amount: monthlyAmount, updated_at: new Date().toISOString() },
            { onConflict: 'household_id,user_id' }
          )
          .select()
          .single();

        if (error) throw error;
        setIncomes((prev) => [...prev.filter((i) => i.user_id !== userId), data as Income]);
      } finally {
        setSavingIncome(false);
      }
    },
    [household, userId]
  );

  const myIncome = incomes.find((i) => i.user_id === userId) ?? null;
  const householdTotal = incomes.reduce((sum, i) => sum + Number(i.monthly_amount), 0);

  return { incomes, myIncome, householdTotal, loading, savingIncome, userId, setMonthlyIncome, refresh: load };
}
