-- Loans: household-shared forward-looking amortization projections for
-- Icelandic non-indexed (óverðtryggð) and CPI-indexed (verðtryggð) loans.
-- This is a snapshot of the loan's CURRENT remaining state, re-entered
-- whenever the user checks their statement — not a payment ledger. All
-- projected figures (payoff date, schedule, interest saved) are derived
-- at read-time by src/lib/loan-amortization.ts, never stored.
--
-- Household-shared like bills/chores, NOT private-per-user like Health —
-- RLS via the existing is_household_member() helper.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  loan_type text not null default 'non_indexed' check (loan_type in ('non_indexed', 'indexed')),
  repayment_type text not null default 'annuity' check (repayment_type in ('annuity', 'equal_principal')),
  principal numeric(12, 2) not null default 0 check (principal >= 0),
  -- Annual nominal rate, e.g. 7.750 for 7.75%. Manual entry only — no
  -- usable public API for stýrivextir exists (only an unstable embedded
  -- Power BI dashboard, not worth integrating).
  interest_rate numeric(6, 3) not null check (interest_rate > -100),
  term_months integer not null check (term_months >= 0),
  -- Only meaningful when loan_type = 'indexed'; not nullable — "not
  -- applicable" here, not "unknown". Hidden in the UI for non_indexed loans.
  assumed_inflation_rate numeric(6, 3) not null default 0,
  extra_monthly_payment numeric(12, 2) not null default 0 check (extra_monthly_payment >= 0),
  as_of_date date not null default current_date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index loans_household_id_idx on public.loans (household_id);

alter table public.loans enable row level security;

create policy "Household members manage loans"
  on public.loans for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
