/** Private-per-user, like Health's tables — one row per (household,
 * user), a snapshot figure rather than a log. Never fetched across
 * users directly; the household TOTAL is only ever read via the
 * `household_total_income` RPC (see use-income.tsx), which never
 * returns individual rows. */
export interface Income {
  id: string;
  household_id: string;
  user_id: string;
  monthly_amount: number;
  created_at: string;
  updated_at: string;
}
