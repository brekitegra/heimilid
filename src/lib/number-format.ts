/** Rounds to 1 decimal place. Also useful for cleaning up numeric(x,y)
 * columns, which Postgres/PostgREST serialize as strings with trailing
 * zeros (e.g. "80.50") — wrap with Number() first, then this, before
 * displaying so the UI shows "80.5" rather than "80.50". */
export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Parses a decimal TextInput's raw string, accepting a comma as the
 * decimal separator (e.g. "8,75") in addition to a period. Plain
 * `Number()` returns NaN for a comma-decimal string — every decimal-pad
 * field in this app (interest/inflation rates, weight, kg) needs this
 * instead of a bare `Number(x) || 0`, since a NaN-then-|| 0 fallback
 * silently turns a mistyped "8,75" into 0 with no error shown anywhere.
 * Returns 0 for empty/invalid input, same fallback shape callers already
 * expect from `Number(x) || 0`. */
export function parseDecimal(value: string): number {
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Parses a whole-currency-amount TextInput's raw string, stripping any
 * thousands-separator punctuation a user might type to match how these
 * amounts are displayed elsewhere in the app (formatISK's
 * "35.000.000 kr."). ISK has no meaningful sub-unit, so unlike
 * parseDecimal there's no decimal-point ambiguity to preserve — every
 * '.'/',' here is a separator to strip, never a decimal point. */
export function parseAmount(value: string): number {
  const n = Number(value.trim().replace(/[.,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
