import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useTranslation } from '@/hooks/use-language';
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
  renameHousehold: (name: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  promoteToOwner: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ session, children }: { session: Session; children: ReactNode }) {
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const userId = session.user.id;
  // Only the very first load should show the blank "loading" state that
  // unmounts everything below HouseholdSwitch. Later calls to this same
  // function (create/join/leave, or a background refresh like syncing XP
  // after a chore) update household/members/error in place instead —
  // flipping `loading` again would tear down and remount the whole
  // household-gated tree, wiping out any screen-local state (e.g. which
  // hub section is open) every time.
  const hasLoadedOnce = useRef(false);

  const loadHousehold = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnce.current;
    if (isInitialLoad) setLoading(true);
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
      if (isInitialLoad) setLoading(false);
      hasLoadedOnce.current = true;
      return;
    }

    const current = membership?.households as unknown as Household | null;

    if (!current) {
      setHousehold(null);
      setMembers([]);
      if (isInitialLoad) setLoading(false);
      hasLoadedOnce.current = true;
      return;
    }

    setHousehold(current);

    const { data: memberRows, error: membersError } = await supabase
      .from('household_members')
      .select('household_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, xp)')
      .eq('household_id', current.id)
      .order('joined_at', { ascending: true });

    if (membersError) {
      setError(membersError.message);
    } else {
      setMembers((memberRows ?? []) as unknown as HouseholdMember[]);
    }

    if (isInitialLoad) setLoading(false);
    hasLoadedOnce.current = true;
  }, [userId]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the signed-in user changes);
    // loadHousehold's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Owner-only (enforced by RLS, not just this check) — renaming the group,
  // not anyone's personal profile.
  const renameHousehold = useCallback(
    async (name: string) => {
      if (!household) return;
      const trimmed = name.trim();
      if (!trimmed) throw new Error(t('householdNameCannotBeEmpty'));
      const { error: updateError } = await supabase.from('households').update({ name: trimmed }).eq('id', household.id);
      if (updateError) throw updateError;
      await loadHousehold();
    },
    [household, loadHousehold, t]
  );

  // Owner-only (enforced by RLS) — removing someone else. Self-removal
  // stays "leave household" instead, on purpose.
  const removeMember = useCallback(
    async (targetUserId: string) => {
      if (!household) return;
      const { error: deleteError } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', household.id)
        .eq('user_id', targetUserId);
      if (deleteError) throw deleteError;
      await loadHousehold();
    },
    [household, loadHousehold]
  );

  // Owner-only (enforced by RLS) — promotes someone else to co-owner.
  // Deliberately additive rather than a strict "transfer": the acting
  // owner keeps their own role, so a household can end up with more than
  // one owner. That's the point — it directly prevents the household ever
  // being left ownerless if one owner later leaves or is removed.
  const promoteToOwner = useCallback(
    async (targetUserId: string) => {
      if (!household) return;
      const { error: updateError } = await supabase
        .from('household_members')
        .update({ role: 'owner' })
        .eq('household_id', household.id)
        .eq('user_id', targetUserId);
      if (updateError) throw updateError;
      await loadHousehold();
    },
    [household, loadHousehold]
  );

  const value = useMemo<HouseholdContextValue>(
    () => ({
      loading,
      household,
      members,
      error,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      renameHousehold,
      removeMember,
      promoteToOwner,
      refresh: loadHousehold,
    }),
    [
      loading,
      household,
      members,
      error,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      renameHousehold,
      removeMember,
      promoteToOwner,
      loadHousehold,
    ]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within a HouseholdProvider');
  return ctx;
}
