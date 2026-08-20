-- Optional "what was originally borrowed" figure, separate from the
-- existing `principal` column (which is always the CURRENT remaining
-- balance as of `as_of_date` — an ongoing projection snapshot, not a
-- ledger). Nullable: leaving it unset means "not tracked", not "zero".
-- Lets the UI show how much of the loan has actually been paid down
-- (original_principal - principal) without needing a full payment
-- ledger.
alter table public.loans add column original_principal numeric(12, 2);
