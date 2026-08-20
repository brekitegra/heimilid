export type BillFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Bill {
  id: string;
  household_id: string;
  account_id: string | null;
  name: string;
  amount: number;
  due_day: number | null;
  frequency: BillFrequency;
  is_paid: boolean;
  last_paid_at: string | null;
  streak_count: number;
  paid_by: string | null;
  created_by: string;
  created_at: string;
}

export interface BillInput {
  name: string;
  amount: number;
  accountId: string | null;
  dueDay: number | null;
  frequency: BillFrequency;
}
