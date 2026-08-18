import { Share } from 'react-native';

import type { Household } from '@/types/household';

/** Opens the platform share sheet with the household's invite code. Shared
 * between the Household tab and the Profile screen so both stay in sync. */
export async function shareHouseholdInvite(household: Household) {
  await Share.share({
    message: `Join our household "${household.name}" on Heimilið! Use invite code: ${household.invite_code}`,
  });
}
