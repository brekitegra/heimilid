import type { Session } from '@supabase/supabase-js';

import AppTabs from '@/components/app-tabs';
import { HouseholdOnboarding } from '@/components/household-onboarding';
import { HouseholdProvider, useHousehold } from '@/hooks/use-household';

function HouseholdSwitch() {
  const { loading, household } = useHousehold();

  if (loading) return null;
  return household ? <AppTabs /> : <HouseholdOnboarding />;
}

/** Renders the app once a user is signed in: their household's tabs if they
 * belong to one, or the create/join flow if they don't yet. */
export function HouseholdGate({ session }: { session: Session }) {
  return (
    <HouseholdProvider session={session}>
      <HouseholdSwitch />
    </HouseholdProvider>
  );
}
