/** Presentation layer over loan-amortization.ts's numeric output — keeps
 * that file purely numeric, no string formatting mixed in (same
 * separation chore-format.ts keeps from chore.ts/use-chores.tsx). */

/** "Paid off by March 2034" from a starting date and a month count. */
export function formatPayoffDate(asOfDate: string, payoffMonths: number): string {
  if (payoffMonths <= 0) return 'Already paid off';
  const start = new Date(`${asOfDate}T00:00:00`);
  const payoff = new Date(start.getFullYear(), start.getMonth() + payoffMonths, start.getDate());
  return `Paid off by ${payoff.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
}

/** "11 yr 4 mo" (or just "4 mo" / "11 yr" when one part is zero) from a
 * month count. */
export function formatLoanDuration(months: number): string {
  if (months <= 0) return '0 mo';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} mo`;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr ${remainingMonths} mo`;
}

/** Term is entered/edited in years in the UI, stored in months in the DB
 * (unchanged column) — these two just do the rounding consistently in
 * one place rather than scattering `* 12`/`/ 12` across the component. */
export function yearsToMonths(years: number): number {
  return Math.round(years * 12);
}

export function monthsToYears(months: number): number {
  return Math.round((months / 12) * 100) / 100;
}

/** How much of the loan has actually been paid down, derived from the
 * optional `original_principal` snapshot vs. the always-current
 * `principal` — never stored directly, so it can't drift. Returns null
 * when the original amount isn't tracked (not the same as "0 paid"). */
export function computePaidOffProgress(originalPrincipal: number | null, currentPrincipal: number): { paidSoFar: number; percent: number } | null {
  if (originalPrincipal === null || originalPrincipal <= 0) return null;
  const paidSoFar = Math.max(0, originalPrincipal - currentPrincipal);
  return { paidSoFar, percent: Math.min(100, (paidSoFar / originalPrincipal) * 100) };
}
