import type { ChoreFrequency } from '@/types/chore';

// Deliberately the same recurrence model as chores (Once/Daily/Weekly/
// Monthly/Yearly) — reuse the type rather than redeclare it.
export type PetCareFrequency = ChoreFrequency;

export interface PetCareTask {
  id: string;
  household_id: string;
  pet_id: string;
  title: string;
  notes: string | null;
  assigned_to: string | null;
  frequency: PetCareFrequency;
  due_date: string | null;
  is_done: boolean;
  last_completed_at: string | null;
  streak_count: number;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PetCareTaskInput {
  title: string;
  frequency: PetCareFrequency;
  assignedTo: string | null;
  dueDate: string | null;
}
