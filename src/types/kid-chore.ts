export type KidChoreFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Mirrors the shape of Chore/PetCareTask exactly (same recurrence,
 * streak, and completed_by conventions), scoped to a child rather than a
 * household member or pet. */
export interface KidChore {
  id: string;
  household_id: string;
  child_id: string;
  title: string;
  notes: string | null;
  assigned_to: string | null;
  frequency: KidChoreFrequency;
  due_date: string | null;
  is_done: boolean;
  last_completed_at: string | null;
  streak_count: number;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface KidChoreInput {
  title: string;
  frequency: KidChoreFrequency;
  dueDate: string | null;
  assignedTo: string | null;
}
