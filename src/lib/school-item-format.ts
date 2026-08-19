import type { SchoolItemType } from '@/types/school-item';

export const SCHOOL_ITEM_TYPES: { value: SchoolItemType; label: string; emoji: string }[] = [
  { value: 'homework', label: 'Homework', emoji: '📓' },
  { value: 'test', label: 'Test', emoji: '📝' },
  { value: 'quiz', label: 'Quiz', emoji: '❓' },
  { value: 'project', label: 'Project', emoji: '🎨' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export function schoolItemTypeLabel(type: SchoolItemType): string {
  return SCHOOL_ITEM_TYPES.find((t) => t.value === type)?.label ?? 'Other';
}

export function schoolItemTypeEmoji(type: SchoolItemType): string {
  return SCHOOL_ITEM_TYPES.find((t) => t.value === type)?.emoji ?? '📌';
}
