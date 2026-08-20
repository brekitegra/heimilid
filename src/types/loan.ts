export type LoanType = 'non_indexed' | 'indexed';
export type RepaymentType = 'annuity' | 'equal_principal';

export interface Loan {
  id: string;
  household_id: string;
  name: string;
  loan_type: LoanType;
  repayment_type: RepaymentType;
  principal: number;
  /** Annual nominal rate, e.g. 7.75 for 7.75%. */
  interest_rate: number;
  term_months: number;
  /** Annual % — drives CPI compounding for indexed loans, and also
   * doubles as the discount rate for every loan's "present value"
   * figure (today's-money value of the total nominal payment stream),
   * so it's collected regardless of loan_type. */
  assumed_inflation_rate: number;
  extra_monthly_payment: number;
  /** What was originally borrowed, entered separately from the
   * always-current `principal` snapshot above so "paid off so far" can
   * be shown. Null means not tracked, not zero. */
  original_principal: number | null;
  as_of_date: string;
  created_by: string;
  created_at: string;
}

export interface LoanInput {
  name: string;
  loanType: LoanType;
  repaymentType: RepaymentType;
  principal: number;
  interestRate: number;
  termMonths: number;
  assumedInflationRate: number;
  extraMonthlyPayment: number;
  originalPrincipal: number | null;
  asOfDate: string;
}
