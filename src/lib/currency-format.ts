/** ISK has no real minor unit in practice (aurar were discontinued in
 * 2003) — always rounds to the nearest whole krona, period thousands
 * separator, "kr." suffix (standard Icelandic convention). Hand-rolled
 * rather than routed through Intl.NumberFormat('is-IS', ...): no other
 * Intl usage exists anywhere in this codebase to lean on, and
 * platform-consistency for a specific locale+currency pair across
 * iOS/Android/web isn't a risk worth taking for money display. */
export function formatISK(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped} kr.`;
}

/** Bills can (rarely) reference a non-ISK finance_account. Falls back to
 * a generic, still-deterministic format rather than risking a
 * currency/locale combination Intl may not fully support. */
export function formatCurrency(amount: number, currency: string = 'ISK'): string {
  if (currency === 'ISK') return formatISK(amount);
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toFixed(2)} ${currency}`;
}
