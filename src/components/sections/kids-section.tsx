import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { CalendarMonthView, type CalendarMarker } from '@/components/calendar-month-view';
import { Checkbox } from '@/components/checkbox';
import { KidsIcon } from '@/components/icons/section-icons';
import { KidsStarBackground } from '@/components/kids-star-background';
import { StarBurst } from '@/components/star-burst';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ageYearsFromBirthDate, birthDateFromAgeYears, formatChildAge } from '@/lib/child-format';
import { formatDueDate } from '@/lib/chore-format';
import { formatKidChoreLastDone, formatKidChoreStreak } from '@/lib/kid-chore-format';
import {
  formatLastAttended,
  formatPracticeStreak,
  formatTimeRange,
  localIsoDateInDays,
  toLocalISODate,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
} from '@/lib/practice-format';
import { SCHOOL_ITEM_TYPES, schoolItemTypeEmoji, schoolItemTypeLabel } from '@/lib/school-item-format';
import { useChildren } from '@/hooks/use-children';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useHousehold } from '@/hooks/use-household';
import { isKidChoreDoneNow, useKidChores } from '@/hooks/use-kid-chores';
import { isPracticeAttended, usePractices } from '@/hooks/use-practices';
import { useSchoolItems } from '@/hooks/use-school-items';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { XpPopup } from '@/components/xp-popup';
import type { Child, ChildInput } from '@/types/child';
import type { KidChore, KidChoreFrequency, KidChoreInput } from '@/types/kid-chore';
import type { Practice, PracticeInput } from '@/types/practice';
import type { SchoolItem, SchoolItemInput, SchoolItemType } from '@/types/school-item';

const DUE_DATE_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'No date', value: null },
  { label: 'Today', value: localIsoDateInDays(0) },
  { label: 'Tomorrow', value: localIsoDateInDays(1) },
  { label: 'In a week', value: localIsoDateInDays(7) },
];

const EVENT_DATE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Today', value: localIsoDateInDays(0) },
  { label: 'Tomorrow', value: localIsoDateInDays(1) },
  { label: 'In 3 days', value: localIsoDateInDays(3) },
  { label: 'In a week', value: localIsoDateInDays(7) },
  { label: 'In 2 weeks', value: localIsoDateInDays(14) },
  { label: 'In a month', value: localIsoDateInDays(30) },
];

const SUBJECT_QUICKPICKS = ['Math', 'Science', 'English', 'History', 'Art', 'PE'];
const ACTIVITY_QUICKPICKS = ['Soccer', 'Basketball', 'Piano', 'Swimming', 'Dance', 'Tutoring'];
const CHORE_QUICKPICKS = ['Make bed', 'Feed pet', 'Tidy room', 'Brush teeth', 'Set the table', 'Homework time'];

const KID_CHORE_FREQUENCIES: { value: KidChoreFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const OVERDUE_COLOR = '#e5484d';
const DAZZLE_MS = 800;

// One distinct color per child (cycled by creation order) — used to tell
// whose activity/school item a calendar marker belongs to at a glance,
// since the grid is too small to fit a name on every dot.
const CHILD_COLORS = ['#C1633D', '#4a90a4', '#7c9c6b', '#b56576', '#c9a227', '#8a6fae'];

function childColor(childId: string, children: Child[]): string {
  const index = children.findIndex((c) => c.id === childId);
  return CHILD_COLORS[index >= 0 ? index % CHILD_COLORS.length : 0];
}

function initials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type MetaPart = { text: string; warn?: boolean };

function buildSchoolMeta(
  item: SchoolItem,
  assigneeName: string | null | undefined,
  completerName: string | null | undefined
): MetaPart[] {
  const parts: MetaPart[] = [{ text: schoolItemTypeLabel(item.item_type) }];
  if (item.subject) parts.push({ text: item.subject });
  if (assigneeName) parts.push({ text: assigneeName });
  if (!item.is_done) {
    const due = formatDueDate(item.due_date);
    if (due) parts.push({ text: due.text, warn: due.overdue });
  }
  // Whoever actually checked it off, not necessarily who it was assigned
  // to — matches Chores'/Pets' "helping out earns credit too" convention.
  if (item.is_done && completerName) parts.push({ text: `Completed by ${completerName}` });
  return parts;
}

function buildPracticeMeta(
  practice: Practice,
  assigneeName: string | null | undefined,
  completerName: string | null | undefined
): MetaPart[] {
  const parts: MetaPart[] = [];
  if (practice.is_recurring) {
    parts.push({ text: practice.day_of_week !== null ? WEEKDAY_SHORT[practice.day_of_week] : 'Weekly' });
  } else if (practice.event_date && !practice.is_done) {
    // Matches chores' buildMeta convention: a completed one-off item never
    // shows its due-date caption (it vanishes from view moments later
    // anyway) — otherwise a just-attended event would flash "Overdue" in
    // plain (non-warning) text during its dazzle window, which reads as
    // confusing noise right when it should read as a win.
    const due = formatDueDate(practice.event_date);
    if (due) parts.push({ text: due.text, warn: due.overdue });
  }
  const timeRange = formatTimeRange(practice.start_time, practice.end_time);
  if (timeRange) parts.push({ text: timeRange });
  if (practice.location) parts.push({ text: practice.location });
  if (assigneeName) parts.push({ text: assigneeName });

  const attended = isPracticeAttended(practice);
  if (practice.is_recurring) {
    const streak = formatPracticeStreak(practice);
    if (streak) parts.push({ text: streak });
    if (!attended) {
      const lastAttended = formatLastAttended(practice);
      if (lastAttended) parts.push({ text: lastAttended });
    }
  }
  // Whoever actually checked it off, not necessarily who it was assigned
  // to — matches Chores'/Pets' "helping out earns credit too" convention.
  if (attended && completerName) parts.push({ text: `Completed by ${completerName}` });
  return parts;
}

function buildChoreMeta(
  chore: KidChore,
  assigneeName: string | null | undefined,
  completerName: string | null | undefined
): MetaPart[] {
  const parts: MetaPart[] = [{ text: KID_CHORE_FREQUENCIES.find((f) => f.value === chore.frequency)?.label ?? '' }];
  if (assigneeName) parts.push({ text: assigneeName });

  const done = isKidChoreDoneNow(chore);
  if (chore.frequency === 'once') {
    if (!chore.is_done) {
      const due = formatDueDate(chore.due_date);
      if (due) parts.push({ text: due.text, warn: due.overdue });
    }
  } else {
    const streak = formatKidChoreStreak(chore);
    if (streak) parts.push({ text: streak });
    if (!done) {
      const lastDone = formatKidChoreLastDone(chore);
      if (lastDone) parts.push({ text: lastDone });
    }
  }
  if (done && completerName) parts.push({ text: `Completed by ${completerName}` });
  return parts;
}

export function KidsSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { members } = useHousehold();
  const {
    children,
    loading: childrenLoading,
    uploadingAvatarId,
    addChild,
    updateChild,
    deleteChild,
    adjustLocalStars,
    pickAndUploadChildAvatar,
    removeChildAvatar,
  } = useChildren();
  const {
    items: schoolItems,
    loading: schoolLoading,
    currentUserId: schoolCurrentUserId,
    addItem: addSchoolItem,
    updateItem: updateSchoolItem,
    toggleItem: toggleSchoolItem,
    deleteItem: deleteSchoolItem,
  } = useSchoolItems();
  const {
    practices,
    loading: practicesLoading,
    currentUserId: practicesCurrentUserId,
    addPractice,
    updatePractice,
    toggleAttended,
    deletePractice,
  } = usePractices();
  const {
    chores,
    loading: choresLoading,
    currentUserId: choresCurrentUserId,
    addChore,
    updateChore,
    toggleChore,
    deleteChore,
  } = useKidChores();
  const scrollRef = useRef<ScrollView>(null);
  // All three hooks resolve the same signed-in session independently —
  // any one copy is fine as the canonical "is this me" reference.
  const currentUserId = schoolCurrentUserId ?? practicesCurrentUserId ?? choresCurrentUserId;

  const [view, setView] = useState<'list' | 'calendar'>('list');
  // Same All/Mine toggle Chores/Pets use, only shown once there's an
  // assignee to filter by (2+ members) and something to filter — affects
  // the List view only, not the Calendar (which is inherently a
  // whole-family view).
  const [showMineOnly, setShowMineOnly] = useState(false);

  // Add/edit-child composer.
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childAgeYears, setChildAgeYears] = useState('');
  const [childNotes, setChildNotes] = useState('');
  const [childEmergencyInfo, setChildEmergencyInfo] = useState('');
  const [childComposerFocused, setChildComposerFocused] = useState(false);
  const childComposerBlur = useDelayedBlur(setChildComposerFocused);
  const [childSubmitting, setChildSubmitting] = useState(false);
  const isChildComposerExpanded = childComposerFocused || childName.trim().length > 0 || editingChildId !== null;

  // Only one child's school-item composer is open at a time — same
  // explicit-button-tap pattern Pets uses, sidestepping the focus-collapse
  // pill-tap bug by construction.
  const [schoolComposerChildId, setSchoolComposerChildId] = useState<string | null>(null);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [schoolTitle, setSchoolTitle] = useState('');
  const [schoolType, setSchoolType] = useState<SchoolItemType>('homework');
  const [schoolSubject, setSchoolSubject] = useState('');
  const [schoolDueDate, setSchoolDueDate] = useState<string | null>(null);
  const [schoolAssignedTo, setSchoolAssignedTo] = useState<string | null>(null);
  const [schoolSubmitting, setSchoolSubmitting] = useState(false);

  const [practiceComposerChildId, setPracticeComposerChildId] = useState<string | null>(null);
  const [editingPracticeId, setEditingPracticeId] = useState<string | null>(null);
  const [practiceTitle, setPracticeTitle] = useState('');
  const [practiceLocation, setPracticeLocation] = useState('');
  const [practiceIsRecurring, setPracticeIsRecurring] = useState(true);
  const [practiceDayOfWeek, setPracticeDayOfWeek] = useState(1);
  const [practiceEventDate, setPracticeEventDate] = useState(EVENT_DATE_OPTIONS[0].value);
  const [practiceStartTime, setPracticeStartTime] = useState('');
  const [practiceEndTime, setPracticeEndTime] = useState('');
  const [practiceAssignedTo, setPracticeAssignedTo] = useState<string | null>(null);
  const [practiceSubmitting, setPracticeSubmitting] = useState(false);

  const [choreComposerChildId, setChoreComposerChildId] = useState<string | null>(null);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [choreTitle, setChoreTitle] = useState('');
  const [choreFrequency, setChoreFrequency] = useState<KidChoreFrequency>('once');
  const [choreDueDate, setChoreDueDate] = useState<string | null>(null);
  const [choreAssignedTo, setChoreAssignedTo] = useState<string | null>(null);
  const [choreSubmitting, setChoreSubmitting] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));

  const [dazzlingIds, setDazzlingIds] = useState<Set<string>>(new Set());
  const [starPopups, setStarPopups] = useState<{ id: string; targetId: string; amount: number }[]>([]);
  const nextPopupId = useRef(0);
  const dazzleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = dazzleTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  function resetChildForm() {
    setEditingChildId(null);
    setChildName('');
    setChildAgeYears('');
    setChildNotes('');
    setChildEmergencyInfo('');
  }

  function startEditChild(child: Child) {
    setEditingChildId(child.id);
    setChildName(child.name);
    setChildAgeYears(ageYearsFromBirthDate(child.birth_date));
    setChildNotes(child.notes ?? '');
    setChildEmergencyInfo(child.emergency_info ?? '');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handleChildSubmit() {
    if (!childName.trim()) return;
    const editingChild = editingChildId ? children.find((c) => c.id === editingChildId) : null;
    const trimmedAge = childAgeYears.trim();
    let birthDate: string | null;
    if (!trimmedAge) {
      birthDate = null;
    } else if (editingChild && ageYearsFromBirthDate(editingChild.birth_date) === trimmedAge) {
      birthDate = editingChild.birth_date;
    } else {
      birthDate = birthDateFromAgeYears(Number(trimmedAge));
    }

    const input: ChildInput = {
      name: childName,
      birthDate,
      notes: childNotes.trim() || null,
      emergencyInfo: childEmergencyInfo.trim() || null,
    };
    setChildSubmitting(true);
    try {
      if (editingChild) {
        await updateChild(editingChild, input);
      } else {
        await addChild(input);
      }
      resetChildForm();
    } catch (err) {
      showAlert(editingChildId ? "Couldn't save changes" : "Couldn't add child", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setChildSubmitting(false);
    }
  }

  async function handleAvatarPress(child: Child) {
    try {
      await pickAndUploadChildAvatar(child);
    } catch (err) {
      showAlert("Couldn't update photo", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleRemoveAvatar(child: Child) {
    try {
      await removeChildAvatar(child);
    } catch (err) {
      showAlert("Couldn't remove photo", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeleteChild(child: Child) {
    showAlert('Remove child', `Remove "${child.name}" and all of their school items and activities?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (editingChildId === child.id) resetChildForm();
          deleteChild(child).catch((err) => {
            showAlert("Couldn't remove child", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  function showStarPopup(targetId: string, amount: number) {
    if (amount <= 0) return;
    const popupId = String(nextPopupId.current++);
    setStarPopups((prev) => [...prev, { id: popupId, targetId, amount }]);
  }
  function removeStarPopup(popupId: string) {
    setStarPopups((prev) => prev.filter((p) => p.id !== popupId));
  }
  function dazzle(id: string) {
    setDazzlingIds((prev) => new Set(prev).add(id));
    const existingTimer = dazzleTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      setDazzlingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      dazzleTimers.current.delete(id);
    }, DAZZLE_MS);
    dazzleTimers.current.set(id, timer);
  }

  // --- School items ---

  function resetSchoolForm() {
    setSchoolComposerChildId(null);
    setEditingSchoolId(null);
    setSchoolTitle('');
    setSchoolType('homework');
    setSchoolSubject('');
    setSchoolDueDate(null);
    setSchoolAssignedTo(null);
  }

  function openSchoolComposer(childId: string) {
    resetSchoolForm();
    setSchoolComposerChildId(childId);
  }

  function startEditSchool(item: SchoolItem) {
    setSchoolComposerChildId(item.child_id);
    setEditingSchoolId(item.id);
    setSchoolTitle(item.title);
    setSchoolType(item.item_type);
    setSchoolSubject(item.subject ?? '');
    setSchoolDueDate(item.due_date);
    setSchoolAssignedTo(item.assigned_to);
  }

  async function handleSchoolSubmit() {
    if (!schoolComposerChildId || !schoolTitle.trim()) return;
    const input: SchoolItemInput = {
      title: schoolTitle,
      itemType: schoolType,
      subject: schoolSubject.trim() || null,
      dueDate: schoolDueDate,
      assignedTo: schoolAssignedTo,
    };
    setSchoolSubmitting(true);
    try {
      if (editingSchoolId) {
        const item = schoolItems.find((i) => i.id === editingSchoolId);
        if (item) await updateSchoolItem(item, input);
      } else {
        await addSchoolItem(schoolComposerChildId, input);
      }
      resetSchoolForm();
    } catch (err) {
      showAlert(editingSchoolId ? "Couldn't save changes" : "Couldn't add item", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSchoolSubmitting(false);
    }
  }

  async function handleToggleSchool(item: SchoolItem) {
    // School items have no recurring state, so "not done yet" already
    // means completing it right now will earn a star.
    if (!item.is_done) dazzle(item.id);
    try {
      const delta = await toggleSchoolItem(item);
      showStarPopup(item.id, delta);
      adjustLocalStars(item.child_id, delta);
    } catch (err) {
      showAlert("Couldn't update item", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeleteSchool(item: SchoolItem) {
    showAlert('Delete item', `Remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingSchoolId === item.id) resetSchoolForm();
          deleteSchoolItem(item).catch((err) => {
            showAlert("Couldn't delete item", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  // --- Practices / activities ---

  function resetPracticeForm() {
    setPracticeComposerChildId(null);
    setEditingPracticeId(null);
    setPracticeTitle('');
    setPracticeLocation('');
    setPracticeIsRecurring(true);
    setPracticeDayOfWeek(1);
    setPracticeEventDate(EVENT_DATE_OPTIONS[0].value);
    setPracticeStartTime('');
    setPracticeEndTime('');
    setPracticeAssignedTo(null);
  }

  function openPracticeComposer(childId: string) {
    resetPracticeForm();
    setPracticeComposerChildId(childId);
  }

  function startEditPractice(practice: Practice) {
    setPracticeComposerChildId(practice.child_id);
    setEditingPracticeId(practice.id);
    setPracticeTitle(practice.title);
    setPracticeLocation(practice.location ?? '');
    setPracticeIsRecurring(practice.is_recurring);
    setPracticeDayOfWeek(practice.day_of_week ?? 1);
    setPracticeEventDate(practice.event_date ?? EVENT_DATE_OPTIONS[0].value);
    setPracticeStartTime(practice.start_time ?? '');
    setPracticeEndTime(practice.end_time ?? '');
    setPracticeAssignedTo(practice.assigned_to);
  }

  async function handlePracticeSubmit() {
    if (!practiceComposerChildId || !practiceTitle.trim()) return;
    const input: PracticeInput = {
      title: practiceTitle,
      location: practiceLocation.trim() || null,
      isRecurring: practiceIsRecurring,
      dayOfWeek: practiceIsRecurring ? practiceDayOfWeek : null,
      eventDate: practiceIsRecurring ? null : practiceEventDate,
      startTime: practiceStartTime.trim() || null,
      endTime: practiceEndTime.trim() || null,
      assignedTo: practiceAssignedTo,
    };
    setPracticeSubmitting(true);
    try {
      if (editingPracticeId) {
        const practice = practices.find((p) => p.id === editingPracticeId);
        if (practice) await updatePractice(practice, input);
      } else {
        await addPractice(practiceComposerChildId, input);
      }
      resetPracticeForm();
    } catch (err) {
      showAlert(editingPracticeId ? "Couldn't save changes" : "Couldn't add activity", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPracticeSubmitting(false);
    }
  }

  async function handleToggleAttended(practice: Practice) {
    // The star burst plays every time a star is actually earned — a
    // recurring activity gets the same little celebration each week it's
    // marked attended, not just a one-off event's final completion.
    const willEarnStars = !isPracticeAttended(practice);
    if (willEarnStars) dazzle(practice.id);
    try {
      const delta = await toggleAttended(practice);
      showStarPopup(practice.id, delta);
      if (practice.child_id) adjustLocalStars(practice.child_id, delta);
    } catch (err) {
      showAlert("Couldn't update activity", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeletePractice(practice: Practice) {
    showAlert('Delete activity', `Remove "${practice.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingPracticeId === practice.id) resetPracticeForm();
          deletePractice(practice).catch((err) => {
            showAlert("Couldn't delete activity", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  // --- Kid chores / responsibilities ---

  function resetChoreForm() {
    setChoreComposerChildId(null);
    setEditingChoreId(null);
    setChoreTitle('');
    setChoreFrequency('once');
    setChoreDueDate(null);
    setChoreAssignedTo(null);
  }

  function openChoreComposer(childId: string) {
    resetChoreForm();
    setChoreComposerChildId(childId);
  }

  function startEditChore(chore: KidChore) {
    setChoreComposerChildId(chore.child_id);
    setEditingChoreId(chore.id);
    setChoreTitle(chore.title);
    setChoreFrequency(chore.frequency);
    setChoreDueDate(chore.due_date);
    setChoreAssignedTo(chore.assigned_to);
  }

  async function handleChoreSubmit() {
    if (!choreComposerChildId || !choreTitle.trim()) return;
    const input: KidChoreInput = {
      title: choreTitle,
      frequency: choreFrequency,
      dueDate: choreDueDate,
      assignedTo: choreAssignedTo,
    };
    setChoreSubmitting(true);
    try {
      if (editingChoreId) {
        const chore = chores.find((c) => c.id === editingChoreId);
        if (chore) await updateChore(chore, input);
      } else {
        await addChore(choreComposerChildId, input);
      }
      resetChoreForm();
    } catch (err) {
      showAlert(editingChoreId ? "Couldn't save changes" : "Couldn't add chore", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setChoreSubmitting(false);
    }
  }

  async function handleToggleChore(chore: KidChore) {
    // Same reasoning as handleToggleAttended — celebrate every star
    // earned, not just a one-off chore's final completion.
    const willEarnStars = !isKidChoreDoneNow(chore);
    if (willEarnStars) dazzle(chore.id);
    try {
      const delta = await toggleChore(chore);
      showStarPopup(chore.id, delta);
      adjustLocalStars(chore.child_id, delta);
    } catch (err) {
      showAlert("Couldn't update chore", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeleteChore(chore: KidChore) {
    showAlert('Delete chore', `Remove "${chore.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingChoreId === chore.id) resetChoreForm();
          deleteChore(chore).catch((err) => {
            showAlert("Couldn't delete chore", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  // --- Grouping ---

  const schoolByChild = useMemo(() => {
    const map = new Map<string, SchoolItem[]>();
    for (const item of schoolItems) {
      const bucket = map.get(item.child_id);
      if (bucket) bucket.push(item);
      else map.set(item.child_id, [item]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return map;
  }, [schoolItems]);

  const practicesByChild = useMemo(() => {
    const map = new Map<string, Practice[]>();
    for (const practice of practices) {
      const bucket = map.get(practice.child_id ?? '');
      if (bucket) bucket.push(practice);
      else map.set(practice.child_id ?? '', [practice]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const aDone = isPracticeAttended(a);
        const bDone = isPracticeAttended(b);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return map;
  }, [practices]);

  const choresByChild = useMemo(() => {
    const map = new Map<string, KidChore[]>();
    for (const chore of chores) {
      const bucket = map.get(chore.child_id);
      if (bucket) bucket.push(chore);
      else map.set(chore.child_id, [chore]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const aDone = isKidChoreDoneNow(a);
        const bDone = isKidChoreDoneNow(b);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return map;
  }, [chores]);

  // --- Calendar markers ---
  // Only once-off chores (a specific due date) show on the calendar —
  // daily/weekly/monthly/yearly ones don't have a single clean day to
  // project onto the way a practice's day_of_week does, so recurring
  // chores stay List-view-only, same as the standalone Chores tab having
  // no calendar of its own either.

  const calendarMarkers = useMemo(() => {
    const map = new Map<string, CalendarMarker[]>();
    const year = calendarMonth.getFullYear();
    const monthIndex = calendarMonth.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    function addMarker(iso: string, color: string) {
      const bucket = map.get(iso);
      if (bucket) bucket.push({ color });
      else map.set(iso, [{ color }]);
    }

    for (const item of schoolItems) {
      if (item.due_date) addMarker(item.due_date, childColor(item.child_id, children));
    }
    for (const practice of practices) {
      const color = childColor(practice.child_id ?? '', children);
      if (!practice.is_recurring) {
        if (practice.event_date) addMarker(practice.event_date, color);
      } else if (practice.day_of_week !== null) {
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, monthIndex, d);
          if (date.getDay() === practice.day_of_week) addMarker(toLocalISODate(date), color);
        }
      }
    }
    for (const chore of chores) {
      if (chore.frequency === 'once' && chore.due_date) addMarker(chore.due_date, childColor(chore.child_id, children));
    }
    return map;
  }, [schoolItems, practices, chores, calendarMonth, children]);

  const selectedDayAgenda = useMemo(() => {
    if (!selectedDate) return [];
    const selectedWeekday = new Date(`${selectedDate}T00:00:00`).getDay();
    const childName = (childId: string) => children.find((c) => c.id === childId)?.name ?? 'Someone';

    const schoolAgenda = schoolItems
      .filter((i) => i.due_date === selectedDate)
      .map((i) => ({ key: `school-${i.id}`, text: `${childName(i.child_id)} — ${schoolItemTypeEmoji(i.item_type)} ${i.title}` }));

    const practiceAgenda = practices
      .filter((p) => (p.is_recurring ? p.day_of_week === selectedWeekday : p.event_date === selectedDate))
      .map((p) => {
        const timeRange = formatTimeRange(p.start_time, p.end_time);
        return {
          key: `practice-${p.id}`,
          text: `${childName(p.child_id ?? '')} — 🏃 ${p.title}${timeRange ? ` (${timeRange})` : ''}`,
        };
      });

    const choreAgenda = chores
      .filter((c) => c.frequency === 'once' && c.due_date === selectedDate)
      .map((c) => ({ key: `chore-${c.id}`, text: `${childName(c.child_id)} — 🧹 ${c.title}` }));

    return [...schoolAgenda, ...practiceAgenda, ...choreAgenda];
  }, [selectedDate, schoolItems, practices, chores, children]);

  function renderSchoolRow(item: SchoolItem) {
    if (item.is_done && !dazzlingIds.has(item.id)) return null;
    const assignee = members.find((m) => m.user_id === item.assigned_to)?.profile?.full_name;
    const completer =
      item.completed_by === schoolCurrentUserId ? 'you' : members.find((m) => m.user_id === item.completed_by)?.profile?.full_name;
    const meta = buildSchoolMeta(item, assignee, completer);
    const isDazzling = dazzlingIds.has(item.id);
    const popupsForRow = starPopups.filter((p) => p.targetId === item.id);

    return (
      <Animated.View key={item.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView type="background" style={[styles.itemRow, editingSchoolId === item.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          {isDazzling && <StarBurst />}
          <View style={styles.checkboxSlot}>
            <Checkbox checked={item.is_done} onToggle={() => handleToggleSchool(item)} />
            {popupsForRow.map((p) => (
              <XpPopup key={p.id} amount={p.amount} suffix="⭐" onDone={() => removeStarPopup(p.id)} />
            ))}
          </View>
          <Pressable style={styles.itemTextWrapper} onPress={() => startEditSchool(item)}>
            <ThemedText type="default" themeColor={item.is_done ? 'textSecondary' : 'text'} style={item.is_done && styles.doneText}>
              {item.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {meta.map((part, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary" style={part.warn && { color: OVERDUE_COLOR }}>
                  {part.text}
                  {i < meta.length - 1 ? ' · ' : ''}
                </ThemedText>
              ))}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDeleteSchool(item)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderPracticeRow(practice: Practice) {
    if (!practice.is_recurring && practice.is_done && !dazzlingIds.has(practice.id)) return null;
    const attended = isPracticeAttended(practice);
    const assignee = members.find((m) => m.user_id === practice.assigned_to)?.profile?.full_name;
    const completer =
      practice.completed_by === practicesCurrentUserId
        ? 'you'
        : members.find((m) => m.user_id === practice.completed_by)?.profile?.full_name;
    const meta = buildPracticeMeta(practice, assignee, completer);
    const isDazzling = dazzlingIds.has(practice.id);
    const popupsForRow = starPopups.filter((p) => p.targetId === practice.id);

    return (
      <Animated.View key={practice.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView
          type="background"
          style={[styles.itemRow, editingPracticeId === practice.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          {isDazzling && <StarBurst />}
          <View style={styles.checkboxSlot}>
            <Checkbox checked={attended} onToggle={() => handleToggleAttended(practice)} />
            {popupsForRow.map((p) => (
              <XpPopup key={p.id} amount={p.amount} suffix="⭐" onDone={() => removeStarPopup(p.id)} />
            ))}
          </View>
          <Pressable style={styles.itemTextWrapper} onPress={() => startEditPractice(practice)}>
            <ThemedText type="default" themeColor={attended ? 'textSecondary' : 'text'} style={attended && !practice.is_recurring && styles.doneText}>
              {practice.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {meta.map((part, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary" style={part.warn && { color: OVERDUE_COLOR }}>
                  {part.text}
                  {i < meta.length - 1 ? ' · ' : ''}
                </ThemedText>
              ))}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDeletePractice(practice)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderChoreRow(chore: KidChore) {
    if (chore.frequency === 'once' && chore.is_done && !dazzlingIds.has(chore.id)) return null;
    const done = isKidChoreDoneNow(chore);
    const assignee = members.find((m) => m.user_id === chore.assigned_to)?.profile?.full_name;
    const completer =
      chore.completed_by === choresCurrentUserId ? 'you' : members.find((m) => m.user_id === chore.completed_by)?.profile?.full_name;
    const meta = buildChoreMeta(chore, assignee, completer);
    const isDazzling = dazzlingIds.has(chore.id);
    const popupsForRow = starPopups.filter((p) => p.targetId === chore.id);

    return (
      <Animated.View key={chore.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView type="background" style={[styles.itemRow, editingChoreId === chore.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          {isDazzling && <StarBurst />}
          <View style={styles.checkboxSlot}>
            <Checkbox checked={done} onToggle={() => handleToggleChore(chore)} />
            {popupsForRow.map((p) => (
              <XpPopup key={p.id} amount={p.amount} suffix="⭐" onDone={() => removeStarPopup(p.id)} />
            ))}
          </View>
          <Pressable style={styles.itemTextWrapper} onPress={() => startEditChore(chore)}>
            <ThemedText type="default" themeColor={done ? 'textSecondary' : 'text'} style={done && styles.doneText}>
              {chore.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {meta.map((part, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary" style={part.warn && { color: OVERDUE_COLOR }}>
                  {part.text}
                  {i < meta.length - 1 ? ' · ' : ''}
                </ThemedText>
              ))}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDeleteChore(chore)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderSchoolComposer(childId: string) {
    return (
      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="background" style={styles.composer}>
          <View style={styles.editingRow}>
            <ThemedText type="smallBold">{editingSchoolId ? 'Edit item' : 'New school item'}</ThemedText>
            <Pressable onPress={resetSchoolForm} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="e.g. Fractions worksheet, Ch. 4 test…"
            placeholderTextColor={theme.textSecondary}
            value={schoolTitle}
            onChangeText={setSchoolTitle}
            onSubmitEditing={handleSchoolSubmit}
            autoFocus
            returnKeyType="done"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {SCHOOL_ITEM_TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setSchoolType(t.value)}
                style={[styles.pill, { backgroundColor: theme.backgroundSelected }, schoolType === t.value && { backgroundColor: theme.accent }]}>
                <ThemedText type="small" themeColor={schoolType === t.value ? 'background' : 'textSecondary'}>
                  {t.emoji} {t.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Subject (optional)"
            placeholderTextColor={theme.textSecondary}
            value={schoolSubject}
            onChangeText={setSchoolSubject}
            onSubmitEditing={handleSchoolSubmit}
            returnKeyType="done"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {SUBJECT_QUICKPICKS.map((s) => (
              <Pressable key={s} onPress={() => setSchoolSubject(s)} style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {s}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {DUE_DATE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                onPress={() => setSchoolDueDate(opt.value)}
                style={[styles.pill, { backgroundColor: theme.backgroundSelected }, schoolDueDate === opt.value && { backgroundColor: theme.accent }]}>
                <ThemedText type="small" themeColor={schoolDueDate === opt.value ? 'background' : 'textSecondary'}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {members.length > 1 && (
            <View style={styles.assigneeRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Assign to
              </ThemedText>
              <View style={styles.assigneeAvatars}>
                {members.map((m) => (
                  <Pressable
                    key={m.user_id}
                    onPress={() => setSchoolAssignedTo((prev) => (prev === m.user_id ? null : m.user_id))}
                    style={[
                      styles.avatar,
                      { backgroundColor: theme.backgroundSelected },
                      schoolAssignedTo === m.user_id && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={schoolAssignedTo === m.user_id ? 'background' : 'text'}>
                      {initials(m.profile?.full_name)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.addButton, { backgroundColor: theme.accent, opacity: schoolTitle.trim() && !schoolSubmitting ? 1 : 0.5 }]}
            disabled={!schoolTitle.trim() || schoolSubmitting}
            onPress={handleSchoolSubmit}>
            <ThemedText type="smallBold" themeColor="background">
              {editingSchoolId ? 'Save changes' : 'Add item'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderPracticeComposer(childId: string) {
    return (
      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="background" style={styles.composer}>
          <View style={styles.editingRow}>
            <ThemedText type="smallBold">{editingPracticeId ? 'Edit activity' : 'New activity'}</ThemedText>
            <Pressable onPress={resetPracticeForm} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="e.g. Soccer practice, Piano lesson…"
            placeholderTextColor={theme.textSecondary}
            value={practiceTitle}
            onChangeText={setPracticeTitle}
            onSubmitEditing={handlePracticeSubmit}
            autoFocus
            returnKeyType="done"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {ACTIVITY_QUICKPICKS.map((a) => (
              <Pressable key={a} onPress={() => setPracticeTitle(a)} style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {a}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {(['recurring', 'oneoff'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setPracticeIsRecurring(mode === 'recurring')}
                style={[
                  styles.pill,
                  { backgroundColor: theme.backgroundSelected },
                  (mode === 'recurring') === practiceIsRecurring && { backgroundColor: theme.accent },
                ]}>
                <ThemedText type="small" themeColor={(mode === 'recurring') === practiceIsRecurring ? 'background' : 'textSecondary'}>
                  {mode === 'recurring' ? 'Recurring weekly' : 'One-time event'}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {practiceIsRecurring ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Pressable
                  key={label}
                  onPress={() => setPracticeDayOfWeek(i)}
                  style={[styles.pill, { backgroundColor: theme.backgroundSelected }, practiceDayOfWeek === i && { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" themeColor={practiceDayOfWeek === i ? 'background' : 'textSecondary'}>
                    {WEEKDAY_SHORT[i]}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {EVENT_DATE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setPracticeEventDate(opt.value)}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.backgroundSelected },
                    practiceEventDate === opt.value && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText type="small" themeColor={practiceEventDate === opt.value ? 'background' : 'textSecondary'}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.timeRow}>
            <TextInput
              style={[styles.input, styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              placeholder="Start (e.g. 4:00 PM)"
              placeholderTextColor={theme.textSecondary}
              value={practiceStartTime}
              onChangeText={setPracticeStartTime}
            />
            <TextInput
              style={[styles.input, styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              placeholder="End (optional)"
              placeholderTextColor={theme.textSecondary}
              value={practiceEndTime}
              onChangeText={setPracticeEndTime}
            />
          </View>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Location (optional)"
            placeholderTextColor={theme.textSecondary}
            value={practiceLocation}
            onChangeText={setPracticeLocation}
            onSubmitEditing={handlePracticeSubmit}
            returnKeyType="done"
          />

          {members.length > 1 && (
            <View style={styles.assigneeRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Assign to
              </ThemedText>
              <View style={styles.assigneeAvatars}>
                {members.map((m) => (
                  <Pressable
                    key={m.user_id}
                    onPress={() => setPracticeAssignedTo((prev) => (prev === m.user_id ? null : m.user_id))}
                    style={[
                      styles.avatar,
                      { backgroundColor: theme.backgroundSelected },
                      practiceAssignedTo === m.user_id && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={practiceAssignedTo === m.user_id ? 'background' : 'text'}>
                      {initials(m.profile?.full_name)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.addButton, { backgroundColor: theme.accent, opacity: practiceTitle.trim() && !practiceSubmitting ? 1 : 0.5 }]}
            disabled={!practiceTitle.trim() || practiceSubmitting}
            onPress={handlePracticeSubmit}>
            <ThemedText type="smallBold" themeColor="background">
              {editingPracticeId ? 'Save changes' : 'Add activity'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderChoreComposer(childId: string) {
    return (
      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="background" style={styles.composer}>
          <View style={styles.editingRow}>
            <ThemedText type="smallBold">{editingChoreId ? 'Edit chore' : 'New chore'}</ThemedText>
            <Pressable onPress={resetChoreForm} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="e.g. Make bed, Feed the dog…"
            placeholderTextColor={theme.textSecondary}
            value={choreTitle}
            onChangeText={setChoreTitle}
            onSubmitEditing={handleChoreSubmit}
            autoFocus
            returnKeyType="done"
          />

          {!editingChoreId && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {CHORE_QUICKPICKS.map((c) => (
                <Pressable key={c} onPress={() => setChoreTitle(c)} style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {c}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {KID_CHORE_FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => {
                  setChoreFrequency(f.value);
                  if (f.value !== 'once') setChoreDueDate(null);
                }}
                style={[styles.pill, { backgroundColor: theme.backgroundSelected }, choreFrequency === f.value && { backgroundColor: theme.accent }]}>
                <ThemedText type="small" themeColor={choreFrequency === f.value ? 'background' : 'textSecondary'}>
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {choreFrequency === 'once' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {DUE_DATE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setChoreDueDate(opt.value)}
                  style={[styles.pill, { backgroundColor: theme.backgroundSelected }, choreDueDate === opt.value && { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" themeColor={choreDueDate === opt.value ? 'background' : 'textSecondary'}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {members.length > 1 && (
            <View style={styles.assigneeRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Assign to
              </ThemedText>
              <View style={styles.assigneeAvatars}>
                {members.map((m) => (
                  <Pressable
                    key={m.user_id}
                    onPress={() => setChoreAssignedTo((prev) => (prev === m.user_id ? null : m.user_id))}
                    style={[
                      styles.avatar,
                      { backgroundColor: theme.backgroundSelected },
                      choreAssignedTo === m.user_id && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={choreAssignedTo === m.user_id ? 'background' : 'text'}>
                      {initials(m.profile?.full_name)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.addButton, { backgroundColor: theme.accent, opacity: choreTitle.trim() && !choreSubmitting ? 1 : 0.5 }]}
            disabled={!choreTitle.trim() || choreSubmitting}
            onPress={handleChoreSubmit}>
            <ThemedText type="smallBold" themeColor="background">
              {editingChoreId ? 'Save changes' : 'Add chore'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderChildCard(child: Child) {
    const schoolAllForChild = schoolByChild.get(child.id) ?? [];
    const schoolForChild = schoolAllForChild
      .filter((i) => !i.is_done || dazzlingIds.has(i.id))
      .filter((i) => !showMineOnly || i.assigned_to === currentUserId);
    const practicesAllForChild = practicesByChild.get(child.id) ?? [];
    const practicesForChild = practicesAllForChild
      .filter((p) => p.is_recurring || !p.is_done || dazzlingIds.has(p.id))
      .filter((p) => !showMineOnly || p.assigned_to === currentUserId);
    const choresAllForChild = choresByChild.get(child.id) ?? [];
    const choresForChild = choresAllForChild
      .filter((c) => !(c.frequency === 'once' && c.is_done) || dazzlingIds.has(c.id))
      .filter((c) => !showMineOnly || c.assigned_to === currentUserId);
    const age = formatChildAge(child.birth_date);
    const caption = [age].filter(Boolean).join(' · ');

    return (
      <ThemedView key={child.id} type="backgroundElement" style={styles.childCard}>
        <View style={styles.childHeaderRow}>
          <Pressable onPress={() => handleAvatarPress(child)} style={styles.avatarWrapper} hitSlop={4}>
            <Avatar url={child.avatar_url} name={child.name} size={48} />
            {uploadingAvatarId === child.id && <ActivityIndicator color={theme.accent} style={StyleSheet.absoluteFill} />}
          </Pressable>
          <Pressable style={styles.childTitleWrapper} onPress={() => startEditChild(child)}>
            <ThemedText type="default" style={styles.childName}>
              {child.name}
            </ThemedText>
            {caption ? (
              <ThemedText type="small" themeColor="textSecondary">
                {caption}
              </ThemedText>
            ) : null}
            <ThemedText type="small" style={{ color: theme.accent }}>
              ⭐ {child.stars} star{child.stars === 1 ? '' : 's'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDeleteChild(child)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </View>

        {child.emergency_info ? (
          <View style={styles.emergencyBox}>
            <ThemedText type="small" style={styles.emergencyText}>
              🚨 {child.emergency_info}
            </ThemedText>
          </View>
        ) : null}

        {child.notes ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.notesText}>
            📝 {child.notes}
          </ThemedText>
        ) : null}

        <View style={styles.subsection}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subsectionHeader}>
            SCHOOL
          </ThemedText>
          {schoolForChild.length > 0 ? (
            <View style={styles.itemList}>{schoolForChild.map(renderSchoolRow)}</View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.childEmptyText}>
              {schoolAllForChild.length === 0
                ? `No school items yet for ${child.name}.`
                : showMineOnly
                  ? `No items assigned to you for ${child.name}.`
                  : `${child.name} is all caught up!`}
            </ThemedText>
          )}
          {schoolComposerChildId === child.id ? (
            renderSchoolComposer(child.id)
          ) : (
            <Pressable onPress={() => openSchoolComposer(child.id)} style={styles.addLink} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                + Add school item
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.subsection}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subsectionHeader}>
            ACTIVITIES
          </ThemedText>
          {practicesForChild.length > 0 ? (
            <View style={styles.itemList}>{practicesForChild.map(renderPracticeRow)}</View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.childEmptyText}>
              {practicesAllForChild.length === 0
                ? `No activities yet for ${child.name}.`
                : showMineOnly
                  ? `No activities assigned to you for ${child.name}.`
                  : `${child.name} is all caught up!`}
            </ThemedText>
          )}
          {practiceComposerChildId === child.id ? (
            renderPracticeComposer(child.id)
          ) : (
            <Pressable onPress={() => openPracticeComposer(child.id)} style={styles.addLink} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                + Add activity or event
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.subsection}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subsectionHeader}>
            CHORES
          </ThemedText>
          {choresForChild.length > 0 ? (
            <View style={styles.itemList}>{choresForChild.map(renderChoreRow)}</View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.childEmptyText}>
              {choresAllForChild.length === 0
                ? `No chores yet for ${child.name}.`
                : showMineOnly
                  ? `No chores assigned to you for ${child.name}.`
                  : `${child.name} is all caught up!`}
            </ThemedText>
          )}
          {choreComposerChildId === child.id ? (
            renderChoreComposer(child.id)
          ) : (
            <Pressable onPress={() => openChoreComposer(child.id)} style={styles.addLink} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                + Add chore
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ThemedView>
    );
  }

  const loading = childrenLoading || schoolLoading || practicesLoading || choresLoading;

  return (
    <View style={styles.container}>
      <KidsStarBackground />
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <ThemedText type="linkPrimary">‹ Home</ThemedText>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {(['list', 'calendar'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.viewPill, { backgroundColor: theme.backgroundSelected }, view === v && { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" themeColor={view === v ? 'background' : 'textSecondary'}>
              {v === 'list' ? 'List' : 'Calendar'}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {view === 'list' && (
        <Animated.View layout={LinearTransition.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.addCard}>
            {editingChildId && (
              <View style={styles.editingRow}>
                <ThemedText type="smallBold">Edit child</ThemedText>
                <Pressable onPress={resetChildForm} hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {editingChildId &&
              (() => {
                const editingChild = children.find((c) => c.id === editingChildId);
                if (!editingChild) return null;
                return (
                  <View style={styles.avatarEditRow}>
                    <Pressable onPress={() => handleAvatarPress(editingChild)} style={styles.avatarWrapper} hitSlop={4}>
                      <Avatar url={editingChild.avatar_url} name={childName} size={64} />
                      {uploadingAvatarId === editingChild.id && (
                        <ActivityIndicator color={theme.accent} style={StyleSheet.absoluteFill} />
                      )}
                    </Pressable>
                    {editingChild.avatar_url && (
                      <Pressable onPress={() => handleRemoveAvatar(editingChild)} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          Remove photo
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })()}

            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Add a child…"
              placeholderTextColor={theme.textSecondary}
              value={childName}
              onChangeText={setChildName}
              onSubmitEditing={handleChildSubmit}
              onFocus={childComposerBlur.onFocus}
              onBlur={childComposerBlur.onBlur}
              returnKeyType="done"
            />

            {isChildComposerExpanded && (
              <>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Age in years (optional)"
                  placeholderTextColor={theme.textSecondary}
                  value={childAgeYears}
                  onChangeText={(text) => setChildAgeYears(text.replace(/[^0-9]/g, ''))}
                  onFocus={childComposerBlur.onFocus}
                  onBlur={childComposerBlur.onBlur}
                  keyboardType="numeric"
                  returnKeyType="done"
                />

                <TextInput
                  style={[styles.input, styles.notesInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor={theme.textSecondary}
                  value={childNotes}
                  onChangeText={setChildNotes}
                  onFocus={childComposerBlur.onFocus}
                  onBlur={childComposerBlur.onBlur}
                  multiline
                />

                <TextInput
                  style={[styles.input, styles.notesInput, styles.emergencyInput, { color: theme.text }]}
                  placeholder="🚨 Emergency info — allergies, doctor, emergency contact (optional)"
                  placeholderTextColor={theme.textSecondary}
                  value={childEmergencyInfo}
                  onChangeText={setChildEmergencyInfo}
                  onFocus={childComposerBlur.onFocus}
                  onBlur={childComposerBlur.onBlur}
                  multiline
                />

                <Pressable
                  style={[styles.addButton, { backgroundColor: theme.accent, opacity: childName.trim() && !childSubmitting ? 1 : 0.5 }]}
                  disabled={!childName.trim() || childSubmitting}
                  onPress={handleChildSubmit}>
                  <ThemedText type="smallBold" themeColor="background">
                    {editingChildId ? 'Save changes' : 'Add child'}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </Animated.View>
      )}

      {view === 'list' && members.length > 1 && schoolItems.length + practices.length + chores.length > 0 && (
        <View style={styles.filterRow}>
          {(['all', 'mine'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setShowMineOnly(f === 'mine')}
              style={[
                styles.pill,
                { backgroundColor: theme.backgroundSelected },
                (f === 'mine') === showMineOnly && { backgroundColor: theme.accent },
              ]}>
              <ThemedText type="small" themeColor={(f === 'mine') === showMineOnly ? 'background' : 'textSecondary'}>
                {f === 'all' ? 'Everyone' : 'Assigned to me'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {loading && children.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && children.length === 0 && (
          <View style={styles.emptyState}>
            <KidsIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No children yet — add one above to start tracking school, practices, and events.
            </ThemedText>
          </View>
        )}

        {view === 'list' && <View style={styles.childrenColumn}>{children.map(renderChildCard)}</View>}

        {view === 'calendar' && children.length > 0 && (
          <View style={styles.calendarWrapper}>
            <ThemedView type="backgroundElement" style={styles.calendarCard}>
              <CalendarMonthView
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                markersByDate={calendarMarkers}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              <View style={styles.legendRow}>
                {children.map((child) => (
                  <View key={child.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: childColor(child.id, children) }]} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {child.name}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.agendaCard}>
              <ThemedText type="smallBold" style={styles.subsectionHeader}>
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </ThemedText>
              {selectedDayAgenda.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nothing scheduled.
                </ThemedText>
              ) : (
                selectedDayAgenda.map((entry) => (
                  <ThemedText key={entry.key} type="small" style={styles.agendaEntry}>
                    {entry.text}
                  </ThemedText>
                ))
              )}
            </ThemedView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.one },
  pillRow: { flexGrow: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  viewPill: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  filterRow: { flexDirection: 'row' },
  assigneeRow: { gap: Spacing.one },
  assigneeAvatars: { flexDirection: 'row', gap: Spacing.two },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingBottom: Spacing.four },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  childrenColumn: { gap: Spacing.three },
  childCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.three },
  childHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, justifyContent: 'space-between' },
  childTitleWrapper: { flex: 1, gap: Spacing.half },
  childName: { fontWeight: '700' },
  avatarWrapper: { position: 'relative' },
  avatarEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  notesText: { fontStyle: 'italic' },
  notesInput: { minHeight: 60, textAlignVertical: 'top', borderRadius: Spacing.two, paddingHorizontal: Spacing.two },
  emergencyInput: { backgroundColor: 'rgba(229, 72, 77, 0.1)' },
  emergencyBox: {
    backgroundColor: 'rgba(229, 72, 77, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: OVERDUE_COLOR,
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  emergencyText: { color: OVERDUE_COLOR },
  subsection: { gap: Spacing.two },
  subsectionHeader: { letterSpacing: 0.5 },
  itemList: { gap: Spacing.two },
  childEmptyText: { paddingVertical: Spacing.one },
  addLink: { paddingVertical: Spacing.one },
  composer: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  checkboxSlot: { position: 'relative' },
  itemTextWrapper: { flex: 1, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 20, lineHeight: 20, paddingHorizontal: Spacing.one },
  timeRow: { flexDirection: 'row', gap: Spacing.two },
  timeInput: { flex: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two },
  calendarWrapper: { gap: Spacing.three },
  calendarCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center', paddingTop: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  agendaCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  agendaEntry: { paddingVertical: Spacing.half },
});
