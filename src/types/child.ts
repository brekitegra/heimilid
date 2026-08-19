export interface Child {
  id: string;
  household_id: string;
  name: string;
  birth_date: string | null;
  notes: string | null;
  emergency_info: string | null;
  avatar_url: string | null;
  stars: number;
  created_by: string | null;
  created_at: string;
}

export interface ChildInput {
  name: string;
  birthDate: string | null;
  notes: string | null;
  emergencyInfo: string | null;
}
