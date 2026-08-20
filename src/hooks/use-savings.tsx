import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type {
  SavingsContribution,
  SavingsContributionInput,
  SavingsGoal,
  SavingsGoalInput,
  SavingsMilestone,
  SavingsMilestoneInput,
} from '@/types/savings';

export function useSavings() {
  const { household } = useHousehold();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [milestones, setMilestones] = useState<SavingsMilestone[]>([]);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
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
      setGoals([]);
      setMilestones([]);
      setContributions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: goalRows, error: goalError } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (goalError) {
      setError(goalError.message);
      setLoading(false);
      return;
    }

    const loadedGoals = (goalRows ?? []) as SavingsGoal[];
    setGoals(loadedGoals);

    const goalIds = loadedGoals.map((g) => g.id);
    if (goalIds.length === 0) {
      setMilestones([]);
      setContributions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const [milestoneRes, contributionRes] = await Promise.all([
      supabase.from('savings_milestones').select('*').in('goal_id', goalIds).order('target_amount', { ascending: true }),
      supabase.from('savings_contributions').select('*').in('goal_id', goalIds).order('contributed_at', { ascending: false }),
    ]);

    if (milestoneRes.error) setError(milestoneRes.error.message);
    else if (contributionRes.error) setError(contributionRes.error.message);
    else setError(null);

    setMilestones((milestoneRes.data ?? []) as SavingsMilestone[]);
    setContributions((contributionRes.data ?? []) as SavingsContribution[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addGoal = useCallback(
    async (input: SavingsGoalInput) => {
      if (!household || !currentUserId) return;
      const { data, error } = await supabase
        .from('savings_goals')
        .insert({
          household_id: household.id,
          name: input.name.trim(),
          target_amount: input.targetAmount,
          target_date: input.targetDate,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (error) throw error;
      setGoals((prev) => [...prev, data as SavingsGoal]);
    },
    [household, currentUserId]
  );

  const updateGoal = useCallback(async (goal: SavingsGoal, input: SavingsGoalInput) => {
    const patch = { name: input.name.trim(), target_amount: input.targetAmount, target_date: input.targetDate };
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from('savings_goals').update(patch).eq('id', goal.id);
    if (error) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
      throw error;
    }
  }, []);

  const deleteGoal = useCallback(async (goal: SavingsGoal) => {
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    setMilestones((prev) => prev.filter((m) => m.goal_id !== goal.id));
    setContributions((prev) => prev.filter((c) => c.goal_id !== goal.id));
    const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
    if (error) throw error; // rows for this goal are gone regardless via ON DELETE CASCADE if this somehow fails oddly; a full reload would recover
  }, []);

  const addMilestone = useCallback(
    async (goalId: string, input: SavingsMilestoneInput) => {
      if (!currentUserId) return;
      const { data, error } = await supabase
        .from('savings_milestones')
        .insert({ goal_id: goalId, label: input.label.trim(), target_amount: input.targetAmount, created_by: currentUserId })
        .select()
        .single();
      if (error) throw error;
      setMilestones((prev) => [...prev, data as SavingsMilestone].sort((a, b) => a.target_amount - b.target_amount));
    },
    [currentUserId]
  );

  const deleteMilestone = useCallback(async (milestone: SavingsMilestone) => {
    setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));
    const { error } = await supabase.from('savings_milestones').delete().eq('id', milestone.id);
    if (error) {
      setMilestones((prev) => [...prev, milestone].sort((a, b) => a.target_amount - b.target_amount));
      throw error;
    }
  }, []);

  const addContribution = useCallback(
    async (goalId: string, input: SavingsContributionInput) => {
      if (!currentUserId) return;
      const { data, error } = await supabase
        .from('savings_contributions')
        .insert({
          goal_id: goalId,
          amount: input.amount,
          note: input.note?.trim() || null,
          contributed_at: input.contributedAt,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (error) throw error;
      setContributions((prev) => [data as SavingsContribution, ...prev]);
    },
    [currentUserId]
  );

  const deleteContribution = useCallback(async (contribution: SavingsContribution) => {
    setContributions((prev) => prev.filter((c) => c.id !== contribution.id));
    const { error } = await supabase.from('savings_contributions').delete().eq('id', contribution.id);
    if (error) {
      setContributions((prev) => [...prev, contribution]);
      throw error;
    }
  }, []);

  return {
    goals,
    milestones,
    contributions,
    loading,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    addMilestone,
    deleteMilestone,
    addContribution,
    deleteContribution,
    refresh: load,
  };
}
