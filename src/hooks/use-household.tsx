import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Household, HouseholdMember } from '@/types/household';

type HouseholdContextValue = {
  loading: boolean;
  household: Household | null;
  members: HouseholdMember[];
  error: string | null;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const userId = session.user.id;

  const loadHousehold = useCallback(async () => {
    setLoading(true);
    setError(null);

    // A person only belongs to one household in this app for now, even
    // though the schema supports more.
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('households(id, name, invite_code, created_by, created_at)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const current = membership?.households as unknown as Household | null;

    if (!current) {
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setHousehold(current);

    const { data: memberRows, error: membersError } = await supabase
      .from('household_members')
      .select('household_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url)')
      .eq('household_id', current.id)
      .order('joined_at', { ascending: true });

    if (membersError) {
      setError(membersError.message);
    } else {
      setMembers((memberRows ?? []) as unknown as HouseholdMember[]);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const createHousehold = useCallback(
    async (name: string) => {
      const { error: rpcError } = await supabase.rpc('create_household', { household_name: name });
      if (rpcError) throw rpcError;
      await loadHousehold();
    },
    [loadHousehold]
  );

  const joinHousehold = useCallback(
    async (inviteCode: string) => {
      const { error: rpcError } = await supabase.rpc('join_household', { code: inviteCode });
      if (rpcError) throw rpcError;
      await loadHousehold();
    },
    [loadHousehold]
  );

  const leaveHousehold = useCallback(async () => {
    if (!household) return;
    const { error: deleteError } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', userId);
    if (deleteError) throw deleteError;
    await loadHousehold();
  }, [household, userId, loadHousehold]);

  const value = useMemo<HouseholdContextValue>(
    () => ({ loading, household, members, error, createHousehold, joinHousehold, leaveHousehold, refresh: loadHousehold }),
    [loading, household, members, error, createHousehold, joinHousehold, leaveHousehold, loadHousehold]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within a HouseholdProvider');
  return ctx;
}
