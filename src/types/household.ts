export type HouseholdRole = 'owner' | 'member';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  profile: Profile | null;
}
