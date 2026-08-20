import type { Bill, BillFrequency } from '@/types/bill';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** "Overdue" / "Due today" / "Due tomorrow" / "Due Jan 5" for a `once`
 * bill's due day. Returns null if there's no due day set. */
export function formatDueDay(dueDay: number | null, now = new Date()): { text: string; overdue: boolean } | null {
  if (!dueDay) return null;
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  const diffDays = Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

  if (diffDays < 0) return { text: 'Overdue', overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: false };
}

/** "Last paid today/yesterday/N days ago" for a recurring bill. Returns
 * null if it's never been paid. */
export function formatLastPaid(bill: Bill, now = new Date()): string | null {
  if (bill.frequency === 'once' || !bill.last_paid_at) return null;
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(new Date(bill.last_paid_at)).getTime()) / MS_PER_DAY);
  if (diffDays <= 0) return 'Last paid today';
  if (diffDays === 1) return 'Last paid yesterday';
  return `Last paid ${diffDays} days ago`;
}

// Average weeks/days per month (365.25/12 days, /7 for weeks) rather
// than a flat 4/30 — small difference, but avoids silently under-
// counting a weekly or daily expense over a full year.
const MONTHLY_EQUIVALENT_FACTOR: Record<BillFrequency, number> = {
  once: 0,
  daily: 365.25 / 12,
  weekly: 365.25 / 12 / 7,
  monthly: 1,
  yearly: 1 / 12,
};

/** A bill's amount converted to its monthly-equivalent cost — e.g. a
 * 120,000 kr *yearly* insurance premium is 10,000 kr/mo here, not
 * 120,000. Used for any "monthly outflow" total; summing bills' raw
 * `amount` directly would silently treat every cadence as if it were
 * monthly. `once` bills have no ongoing monthly cost, so this is 0 for
 * them — callers should filter those out separately if they want to
 * show pending one-off amounts on their own. */
export function monthlyEquivalent(bill: Bill): number {
  return Number(bill.amount) * MONTHLY_EQUIVALENT_FACTOR[bill.frequency];
}

const STREAK_UNIT: Partial<Record<BillFrequency, string>> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

/** "3-month streak" once there's something worth noting (2+ in a row).
 * Returns null for `once` bills or a streak that hasn't started. */
export function formatBillStreak(bill: Bill): string | null {
  const unit = STREAK_UNIT[bill.frequency];
  if (!unit || bill.streak_count < 2) return null;
  return `${bill.streak_count}-${unit} streak`;
}
