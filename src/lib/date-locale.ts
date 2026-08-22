import type { Language } from '@/hooks/use-language';

// Hand-rolled instead of trusting Intl/toLocaleDateString's per-runtime
// ICU data for 'is-IS' — confirmed unreliable in at least one real
// environment (silently falls back to English month names, capitalized,
// instead of throwing or returning the actual Icelandic word). Same
// class of risk currency-format.ts's formatISK doc comment already
// flags for money; this is the date-formatting equivalent of that.
const MONTHS_LONG_IS = [
  'janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní',
  'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember',
];
const MONTHS_SHORT_IS = ['jan.', 'feb.', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'sept.', 'okt.', 'nóv.', 'des.'];

/** "March 2034" / "mars 2034". */
export function formatMonthYear(date: Date, language: Language): string {
  if (language === 'is') return `${MONTHS_LONG_IS[date.getMonth()]} ${date.getFullYear()}`;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "Mar 5" / "5. mars" — Icelandic conventionally puts the day first. */
export function formatMonthDay(date: Date, language: Language): string {
  if (language === 'is') return `${date.getDate()}. ${MONTHS_SHORT_IS[date.getMonth()]}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "March 5, 2034" / "5. mars 2034" — long form with day, for headers. */
export function formatFullDate(date: Date, language: Language): string {
  if (language === 'is') return `${date.getDate()}. ${MONTHS_LONG_IS[date.getMonth()]} ${date.getFullYear()}`;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
