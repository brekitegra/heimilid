import type { SchoolItemType } from '@/types/school-item';
import type { Language } from '@/hooks/use-language';

export const SCHOOL_ITEM_TYPES: { value: SchoolItemType; label: string; emoji: string }[] = [
  { value: 'homework', label: 'Homework', emoji: '📓' },
  { value: 'test', label: 'Test', emoji: '📝' },
  { value: 'quiz', label: 'Quiz', emoji: '❓' },
  { value: 'project', label: 'Project', emoji: '🎨' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

// A plain lookup (not a constructed sentence), but still no hook access
// from this file — see chore-format.ts's doc comment — so it takes
// `language` directly rather than going through t().
const SCHOOL_ITEM_LABEL_IS: Record<SchoolItemType, string> = {
  homework: 'Heimavinna',
  test: 'Próf',
  quiz: 'Spurningakeppni',
  project: 'Verkefni',
  other: 'Annað',
};

export function schoolItemTypeLabel(type: SchoolItemType, language: Language = 'en'): string {
  if (language === 'is') return SCHOOL_ITEM_LABEL_IS[type] ?? 'Annað';
  return SCHOOL_ITEM_TYPES.find((t) => t.value === type)?.label ?? 'Other';
}

export function schoolItemTypeEmoji(type: SchoolItemType): string {
  return SCHOOL_ITEM_TYPES.find((t) => t.value === type)?.emoji ?? '📌';
}
