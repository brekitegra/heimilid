import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Loan, LoanInput } from '@/types/loan';

/** Stays a thin data layer — no amortization math here. Callers pass the
 * (Number()-coerced) loan row straight into loan-amortization.ts, the
 * same way use-workouts.tsx delegates "is this done now" to the plain
 * isWorkoutDoneNow function rather than computing derived state inline. */
export function useLoans() {
  const { household } = useHousehold();
  const [loans, setLoans] = useState<Loan[]>([]);
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
      setLoans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (error) setError(error.message);
    else {
      setError(null);
      setLoans((data ?? []) as Loan[]);
    }
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addLoan = useCallback(
    async (input: LoanInput) => {
      if (!household || !currentUserId) return;

      const { data, error } = await supabase
        .from('loans')
        .insert({
          household_id: household.id,
          name: input.name.trim(),
          loan_type: input.loanType,
          repayment_type: input.repaymentType,
          principal: input.principal,
          interest_rate: input.interestRate,
          term_months: input.termMonths,
          assumed_inflation_rate: input.assumedInflationRate,
          extra_monthly_payment: input.extraMonthlyPayment,
          original_principal: input.originalPrincipal,
          as_of_date: input.asOfDate,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setLoans((prev) => [...prev, data as Loan]);
    },
    [household, currentUserId]
  );

  const updateLoan = useCallback(async (loan: Loan, input: LoanInput) => {
    const patch = {
      name: input.name.trim(),
      loan_type: input.loanType,
      repayment_type: input.repaymentType,
      principal: input.principal,
      interest_rate: input.interestRate,
      term_months: input.termMonths,
      assumed_inflation_rate: input.assumedInflationRate,
      extra_monthly_payment: input.extraMonthlyPayment,
      original_principal: input.originalPrincipal,
      as_of_date: input.asOfDate,
    };

    setLoans((prev) => prev.map((l) => (l.id === loan.id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from('loans').update(patch).eq('id', loan.id);
    if (error) {
      setLoans((prev) => prev.map((l) => (l.id === loan.id ? loan : l)));
      throw error;
    }
  }, []);

  const deleteLoan = useCallback(async (loan: Loan) => {
    setLoans((prev) => prev.filter((l) => l.id !== loan.id));
    const { error } = await supabase.from('loans').delete().eq('id', loan.id);
    if (error) {
      setLoans((prev) => [...prev, loan].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    loans,
    loading,
    error,
    addLoan,
    updateLoan,
    deleteLoan,
    refresh: load,
  };
}
