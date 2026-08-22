import type { Bill, BillFrequency } from '@/types/bill';
import type { Language } from '@/hooks/use-language';
import { formatMonthDay } from '@/lib/date-locale';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_PER_DAY = 86_400_000;

/** "Overdue" / "Due today" / "Due tomorrow" / "Due Jan 5" for a `once`
 * bill's due day. Returns null if there's no due day set. Plain function,
 * no hook access — see chore-format.ts's doc comment — so it takes
 * `language` directly rather than going through t(). */
export function formatDueDay(dueDay: number | null, now = new Date(), language: Language = 'en'): { text: string; overdue: boolean } | null {
  if (!dueDay) return null;
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  const diffDays = Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

  if (language === 'is') {
    if (diffDays < 0) return { text: 'Yfir gjalddaga', overdue: true };
    if (diffDays === 0) return { text: 'Gjalddagi í dag', overdue: false };
    if (diffDays === 1) return { text: 'Gjalddagi á morgun', overdue: false };
    return { text: `Gjalddagi ${formatMonthDay(due, language)}`, overdue: false };
  }
  if (diffDays < 0) return { text: 'Overdue', overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${formatMonthDay(due, language)}`, overdue: false };
}

/** "Last paid today/yesterday/N days ago" for a recurring bill. Returns
 * null if it's never been paid. */
export function formatLastPaid(bill: Bill, now = new Date(), language: Language = 'en'): string | null {
  if (bill.frequency === 'once' || !bill.last_paid_at) return null;
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(new Date(bill.last_paid_at)).getTime()) / MS_PER_DAY);
  if (language === 'is') {
    if (diffDays <= 0) return 'Síðast greitt í dag';
    if (diffDays === 1) return 'Síðast greitt í gær';
    return `Síðast greitt fyrir ${diffDays} dögum`;
  }
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

const STREAK_UNIT_IS: Partial<Record<BillFrequency, string>> = {
  daily: 'daga',
  weekly: 'vikna',
  monthly: 'mánaða',
  yearly: 'ára',
};

/** "3-month streak" once there's something worth noting (2+ in a row).
 * Returns null for `once` bills or a streak that hasn't started. */
export function formatBillStreak(bill: Bill, language: Language = 'en'): string | null {
  const unit = STREAK_UNIT[bill.frequency];
  if (!unit || bill.streak_count < 2) return null;
  if (language === 'is') return `${bill.streak_count} ${STREAK_UNIT_IS[bill.frequency]} runa`;
  return `${bill.streak_count}-${unit} streak`;
}
