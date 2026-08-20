import type { LoanType, RepaymentType } from '@/types/loan';

export type AmortizationMonth = {
  month: number;
  payment: number;
  principalPortion: number;
  interestPortion: number;
  /** Nominal kr added to the balance this month by assumed CPI growth.
   * Always 0 for non_indexed loans. */
  indexationAdded: number;
  endingBalance: number;
};

export type AmortizationResult = {
  schedule: AmortizationMonth[];
  payoffMonths: number;
  /** Month-1 nominal payment, before any extra overpayment — the
   * "sticker" figure a bank statement would show. */
  scheduledMonthlyPayment: number;
  totalInterestPaid: number;
  totalIndexationAdded: number;
  totalPaid: number;
  /** Defensive flag — should never actually be true given the real-terms
   * model below, but the simulation loop is hard-capped as insurance. */
  didNotConverge: boolean;
};

export type LoanScheduleInput = {
  principal: number;
  interestRate: number;
  termMonths: number;
  loanType: LoanType;
  repaymentType: RepaymentType;
  assumedInflationRate: number;
  extraMonthlyPayment: number;
};

const MAX_ITERATIONS = 1200; // 100 years — far beyond any real household loan

/** Annual % → monthly geometric equivalent, e.g. 3.9 → ~0.0032. Inflation
 * compounds, so this is `(1+r)^(1/12)-1`, not a simple /12 (that
 * conversion is reserved for the loan's own quoted interest_rate —
 * Icelandic lenders quote that one to be divided directly by 12). Shared
 * by the indexed-loan CPI mechanics below and by computePresentValue,
 * so the two never drift apart. */
function annualToMonthlyGeometric(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

function emptyResult(): AmortizationResult {
  return {
    schedule: [],
    payoffMonths: 0,
    scheduledMonthlyPayment: 0,
    totalInterestPaid: 0,
    totalIndexationAdded: 0,
    totalPaid: 0,
    didNotConverge: false,
  };
}

/**
 * Simulates a loan month-by-month to payoff.
 *
 * Non-indexed and indexed loans share one recurrence: indexed
 * (verðtryggð) loans are simulated in "real" (today's-money) terms
 * internally, then every nominal krona figure is derived by scaling with
 * a cumulative CPI index factor. Naively inflating the running balance
 * each month and then subtracting a fixed nominal payment does NOT
 * reliably amortize to zero — that recurrence was only ever calibrated
 * for the interest-rate growth factor over `termMonths`, never for the
 * extra inflation multiplier, so depending on the rate/inflation
 * combination it can pay off far later than `termMonths`, or fail to
 * converge at all.
 *
 * The real-terms model here is the standard, well-understood mechanic
 * for verðtryggð loans — not a simplification — and correctly
 * reproduces the well-known property that the *nominal* owed balance can
 * rise for the first several years before falling (early annuity
 * payments are interest-heavy, so the real balance declines slowly while
 * the index keeps climbing). It's also guaranteed to converge in exactly
 * `termMonths` before extra payments, since the real-terms math is
 * identical to the non-indexed case.
 *
 * The one genuine v1 simplification: the base real payment (or fixed
 * principal portion) is computed ONCE from the current
 * principal/rate/term and held constant for the whole remaining term —
 * no future interest-rate-reset events are modeled. Consistent with this
 * being a current-state projection, not a payment ledger.
 *
 * Rate conventions — two different conversions, do not conflate them:
 * - `interestRate` (the loan's own quoted annual rate) → simple /12.
 *   Icelandic lenders quote this to be divided directly by 12 — that's
 *   what the standard annuity formula assumes.
 * - `assumedInflationRate` (a CPI growth assumption, indexed loans only)
 *   → geometric monthly equivalent, since inflation compounds.
 */
export function computeLoanSchedule(loan: LoanScheduleInput): AmortizationResult {
  const principal = Math.max(0, loan.principal);
  const termMonths = Math.max(0, Math.floor(loan.termMonths));
  if (principal <= 0 || termMonths <= 0) return emptyResult();

  const rMonth = loan.interestRate / 100 / 12;
  const isIndexed = loan.loanType === 'indexed';
  const iMonth = isIndexed ? annualToMonthlyGeometric(loan.assumedInflationRate) : 0;
  const extra = Math.max(0, loan.extraMonthlyPayment);

  // Base "real" payment/fixed-principal, computed once from the current
  // principal/rate/term. Identical whether or not the loan is indexed —
  // indexation is handled entirely via the idx() scaling below, never by
  // touching this base figure.
  let realBasePayment: number;
  let realFixedPrincipal = 0;
  if (loan.repaymentType === 'annuity') {
    realBasePayment = Math.abs(rMonth) < 1e-9 ? principal / termMonths : (principal * rMonth) / (1 - Math.pow(1 + rMonth, -termMonths));
  } else {
    realFixedPrincipal = principal / termMonths;
    realBasePayment = realFixedPrincipal + principal * rMonth; // month-1 figure only; interest recomputed per-month below
  }

  const schedule: AmortizationMonth[] = [];
  let realBalance = principal;
  let idxPrev = 1; // idx(0) — baseline, no indexation accrued yet
  let totalInterestPaid = 0;
  let totalIndexationAdded = 0;
  let totalPaid = 0;
  let scheduledMonthlyPayment = 0;
  let didNotConverge = true;

  for (let month = 1; month <= MAX_ITERATIONS; month++) {
    const idx = month === 1 ? 1 : idxPrev * (1 + iMonth);

    const realInterest = realBalance * rMonth;
    const realPrincipalDesired = loan.repaymentType === 'annuity' ? realBasePayment - realInterest : realFixedPrincipal;
    const realExtraDesired = extra / idx;

    const desiredReduction = realPrincipalDesired + realExtraDesired;
    const isPayoffMonth = desiredReduction >= realBalance;
    const actualReduction = isPayoffMonth ? realBalance : desiredReduction;
    const realPrincipalPortion = isPayoffMonth ? Math.min(realPrincipalDesired, actualReduction) : realPrincipalDesired;
    const realExtraPortion = actualReduction - realPrincipalPortion;

    const indexationAdded = isIndexed ? realBalance * (idx - idxPrev) : 0;
    const interestPortion = realInterest * idx;
    const principalPortion = realPrincipalPortion * idx;
    const extraPortion = realExtraPortion * idx;
    const payment = interestPortion + principalPortion + extraPortion;

    realBalance = Math.max(0, realBalance - actualReduction);
    const endingBalance = realBalance * idx;

    if (month === 1) scheduledMonthlyPayment = interestPortion + principalPortion;

    totalInterestPaid += interestPortion;
    totalIndexationAdded += indexationAdded;
    totalPaid += payment;

    schedule.push({ month, payment, principalPortion, interestPortion, indexationAdded, endingBalance });

    idxPrev = idx;

    if (realBalance <= 1e-6) {
      didNotConverge = false;
      break;
    }
  }

  return {
    schedule,
    payoffMonths: schedule.length,
    scheduledMonthlyPayment,
    totalInterestPaid,
    totalIndexationAdded,
    totalPaid,
    didNotConverge,
  };
}

/** Runs the schedule twice — as-entered, and with extraMonthlyPayment
 * forced to 0 — and diffs them. Single source of truth for the
 * month-by-month mechanics; never duplicates the recurrence. */
export function computeOverpaymentImpact(loan: LoanScheduleInput): { monthsSaved: number; interestSaved: number } {
  if (loan.extraMonthlyPayment <= 0) return { monthsSaved: 0, interestSaved: 0 };

  const withExtra = computeLoanSchedule(loan);
  const withoutExtra = computeLoanSchedule({ ...loan, extraMonthlyPayment: 0 });

  return {
    monthsSaved: Math.max(0, withoutExtra.payoffMonths - withExtra.payoffMonths),
    interestSaved: Math.max(0, withoutExtra.totalInterestPaid - withExtra.totalInterestPaid),
  };
}

/**
 * Discounts a schedule's nominal payment stream back to today's money
 * using `assumedAnnualDiscountRate` (the same geometric monthly
 * conversion the indexed-loan CPI mechanics use). This is a general
 * time-value-of-money figure, independent of whether the loan itself is
 * indexed — a flat 275,465 kr/month non-indexed payment 30 years from
 * now is still worth much less in today's money, and showing that
 * "present value" alongside the raw total-paid figure is what makes the
 * two loan types genuinely comparable. Uses the loan's own
 * `assumedInflationRate` as the discount rate — one field, dual purpose
 * (CPI driver for indexed loans, always the discount rate here).
 */
export function computePresentValue(schedule: AmortizationMonth[], assumedAnnualDiscountRate: number): number {
  const iMonth = annualToMonthlyGeometric(assumedAnnualDiscountRate);
  return schedule.reduce((sum, m) => sum + m.payment / Math.pow(1 + iMonth, m.month), 0);
}
