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

/** Strips everything except digits and a single decimal separator
 * (comma or period) as the user types — `keyboardType="number-pad"` /
 * `"decimal-pad"` only hint at a numeric on-screen keyboard on
 * iOS/Android; on web (React Native Web) it does nothing, so a physical
 * keyboard can type letters into these fields with no feedback at all.
 * Pair with `onChangeText={(v) => setX(sanitizeNumericInput(v))}` on any
 * numeric TextInput. Deliberately permissive about a trailing/lone
 * separator (e.g. "12," while still typing "12,5") rather than fighting
 * the user mid-keystroke — `parseDecimal` handles the final value. */
export function sanitizeNumericInput(value: string): string {
  const cleaned = value.replace(/[^0-9.,]/g, '');
  const firstSeparator = cleaned.search(/[.,]/);
  if (firstSeparator === -1) return cleaned;
  return cleaned.slice(0, firstSeparator + 1) + cleaned.slice(firstSeparator + 1).replace(/[.,]/g, '');
}

/** Live thousands-grouping for a whole-ISK-amount TextInput as the user
 * types — "1500000" reformats to "1.500.000" on every keystroke, the
 * same grouping `formatISK` (currency-format.ts) uses for displaying an
 * already-computed amount, just applied live to raw input instead.
 * Strips everything but digits first (so pasting an already-formatted
 * number, or backspacing into the middle of one, still works cleanly),
 * then re-groups from scratch — deliberately not trying to preserve
 * cursor position mid-edit, which isn't worth the complexity for a
 * field that's usually typed left-to-right. Pair with
 * `onChangeText={(v) => setX(formatAmountInput(v))}` on any whole-ISK
 * amount TextInput; `parseAmount` already strips this same punctuation
 * back out when the value is actually used. */
export function formatAmountInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return String(Number(digits)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
