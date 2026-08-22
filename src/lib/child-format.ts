import type { Language } from '@/hooks/use-language';

// Mirrors pet-format.ts's age helpers exactly — same birth-date math, just
// worded for a kid rather than a pet. Same language-branching approach —
// see chore-format.ts's doc comment for why these plain functions take
// `language` directly instead of using t().

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "3 years old" / "8 months old" / "Newborn" from a birth date. Returns
 * null if there's no birth date set. The Icelandic branch drops the
 * gendered "gamall/gömul/gamalt" adjective (no gender field to agree
 * with) — "3 ára"/"8 mánaða" alone is standard, natural Icelandic for
 * stating an age. */
export function formatChildAge(birthDate: string | null, now = new Date(), language: Language = 'en'): string | null {
  if (!birthDate) return null;
  const birth = startOfDay(new Date(`${birthDate}T00:00:00`));
  if (Number.isNaN(birth.getTime())) return null;

  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);

  if (language === 'is') {
    if (months < 1) return 'Nýfætt';
    if (months < 12) return `${months} mánaða`;
    return `${Math.floor(months / 12)} ára`;
  }
  if (months < 1) return 'Newborn';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} old`;
}

/** Converts a whole-number "age in years" entry into an approximate birth
 * date (today, N years back) — good enough for display without needing a
 * full date picker. */
export function birthDateFromAgeYears(ageYears: number, now = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - ageYears);
  return d.toISOString().slice(0, 10);
}

/** The reverse, for pre-filling the edit form — whole years only, rounded
 * down, matching how the age was entered. */
export function ageYearsFromBirthDate(birthDate: string | null, now = new Date()): string {
  if (!birthDate) return '';
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) years -= 1;
  return years > 0 ? String(years) : '';
}
