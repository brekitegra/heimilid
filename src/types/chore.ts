export type ChoreFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Chore {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  assigned_to: string | null;
  frequency: ChoreFrequency;
  due_date: string | null;
  is_done: boolean;
  last_completed_at: string | null;
  streak_count: number;
  created_by: string;
  created_at: string;
}

export interface ChoreInput {
  title: string;
  frequency: ChoreFrequency;
  assignedTo: string | null;
  dueDate: string | null;
}
