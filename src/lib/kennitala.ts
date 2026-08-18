// Weights for the standard Icelandic kennitala (national ID) checksum —
// applies over the first 8 digits only (DDMMYY + 2-digit serial number).
// The 9th digit is the resulting check digit; the 10th is a separate
// century marker (roughly: 9 for 1900s-born, 0 for 2000s-born) that isn't
// part of the checksum at all — a mistake in an earlier version of this
// file included it as a 9th weight and validated against the 10th digit
// instead of the 9th, rejecting every real kennitala.
const CHECK_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

/** Reformats free-typed digits into "DDMMYY-XXXX" as the user types, so the
 * hyphen appears on its own without them having to type it. */
export function formatKennitala(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** Validates the standard modulo-11 kennitala checksum. Doesn't check that
 * the leading 6 digits form a real calendar date — good enough for
 * catching typos without being a full civil-registry lookup. */
export function isValidKennitala(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return false;

  const nums = digits.split('').map(Number);
  const sum = CHECK_WEIGHTS.reduce((acc, weight, i) => acc + weight * nums[i], 0);
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  if (checkDigit === 10) return false; // no valid kennitala ever produces this

  return checkDigit === nums[8];
}
