export interface SavingsGoal {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  created_by: string;
  created_at: string;
}

export interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  targetDate: string | null;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  amount: number;
  note: string | null;
  contributed_at: string;
  created_by: string;
  created_at: string;
}

export interface SavingsContributionInput {
  amount: number;
  note: string | null;
  contributedAt: string;
}
