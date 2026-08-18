// Weights for the standard Icelandic kennitala (national ID) checksum —
// applies to both individuals (DDMMYY-XXXX) and companies alike.
const CHECK_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2, 1];

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

  return checkDigit === nums[9];
}
