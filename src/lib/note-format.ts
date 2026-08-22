import type { Language } from '@/hooks/use-language';
import { formatMonthDay } from '@/lib/date-locale';

/** "Today at 2:30 PM" / "Yesterday at 2:30 PM" / "Aug 21" for a note's
 * timestamp — presentation layer over use-notes.tsx's plain data,
 * mirroring the rest of this app's *-format.ts convention. Plain
 * function, no hook access — see chore-format.ts's doc comment — so it
 * takes `language` directly rather than going through t(). */
export function formatNoteTimestamp(iso: string, now = new Date(), language: Language = 'en'): string {
  const date = new Date(iso);
  const locale = language === 'is' ? 'is-IS' : 'en-US';
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return language === 'is' ? `Í dag kl. ${time}` : `Today at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return language === 'is' ? `Í gær kl. ${time}` : `Yesterday at ${time}`;

  return formatMonthDay(date, language);
}
