import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
import { Checkbox } from '@/components/checkbox';
import { PetsIcon } from '@/components/icons/section-icons';
import { PetsPawBackground } from '@/components/pets-paw-background';
import { SparkleBurst } from '@/components/sparkle-burst';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isoDateInDays, formatDueDate } from '@/lib/chore-format';
import { formatCareStreak, formatCareLastDone } from '@/lib/pet-care-format';
import { ageYearsFromBirthDate, birthDateFromAgeYears, formatPetAge, speciesEmoji } from '@/lib/pet-format';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useGrocery } from '@/hooks/use-grocery';
import { useHousehold } from '@/hooks/use-household';
import { isPetCareDoneNow, usePetCare } from '@/hooks/use-pet-care';
import { usePets } from '@/hooks/use-pets';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { XpPopup } from '@/components/xp-popup';
import type { PetCareFrequency, PetCareTask, PetCareTaskInput } from '@/types/pet-care';
import type { Pet, PetInput } from '@/types/pet';

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Other'];

const FREQUENCIES: { value: PetCareFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const DUE_DATE_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'No date', value: null },
  { label: 'Today', value: isoDateInDays(0) },
  { label: 'Tomorrow', value: isoDateInDays(1) },
  { label: 'In a week', value: isoDateInDays(7) },
];

// Common care tasks, one tap away instead of typing a title from scratch —
// each comes with a sensible default frequency.
const QUICK_TASKS: { label: string; frequency: PetCareFrequency }[] = [
  { label: 'Feed', frequency: 'daily' },
  { label: 'Walk', frequency: 'daily' },
  { label: 'Vet checkup', frequency: 'once' },
  { label: 'Grooming', frequency: 'monthly' },
  { label: 'Nail trim', frequency: 'monthly' },
  { label: 'Medication', frequency: 'daily' },
];

const OVERDUE_COLOR = '#e5484d';
const THRIVING_COLOR = '#4a9d5f';
// How long a just-finished one-off task lingers (flashing, sparkling)
// before it actually leaves the list — mirrors the chores dazzle beat.
const DAZZLE_MS = 800;

function initials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type MetaPart = { text: string; warn?: boolean };

function buildMeta(task: PetCareTask, assigneeName: string | null | undefined, completerName: string | null | undefined): MetaPart[] {
  const parts: MetaPart[] = [{ text: FREQUENCIES.find((f) => f.value === task.frequency)?.label ?? '' }];
  if (assigneeName) parts.push({ text: assigneeName });

  const done = isPetCareDoneNow(task);

  if (task.frequency === 'once') {
    if (!task.is_done) {
      const due = formatDueDate(task.due_date);
      if (due) parts.push({ text: due.text, warn: due.overdue });
    }
  } else {
    const streak = formatCareStreak(task);
    if (streak) parts.push({ text: streak });
    if (!done) {
      const lastDone = formatCareLastDone(task);
      if (lastDone) parts.push({ text: lastDone });
    }
  }

  if (done && completerName) parts.push({ text: `Completed by ${completerName}` });

  return parts;
}

type PetMood = { emoji: string; label: string; caption: string; color: string };

/** A pet's care "mood" — not stored anywhere, purely derived each render
 * from its current tasks (same "derive, don't store" philosophy
 * `isChoreDoneNow` already uses). Turns a plain task list into something
 * that visibly reacts to how consistently it's actually being cared for —
 * an overdue one-off drags it down immediately regardless of everything
 * else; otherwise it's the share of *recurring* tasks currently "in good
 * standing", with an ongoing streak called out by name once there's one
 * worth bragging about.
 *
 * Deliberately excludes completed once-off tasks from the ratio (they're
 * never deleted, just hidden from the visible list) — otherwise a pet
 * with a long history of old completed one-offs (past vet visits, say)
 * would have its mood permanently propped up by that history, drowning
 * out a currently-neglected recurring task. Only "is something overdue
 * right now" and "are ongoing routines being kept up" should matter —
 * archived one-off completions carry no ongoing signal either way. */
function computePetMood(petTasks: PetCareTask[], theme: { textSecondary: string }): PetMood | null {
  if (petTasks.length === 0) return null;

  const now = new Date();
  const recurringTasks = petTasks.filter((t) => t.frequency !== 'once');
  const pendingOnce = petTasks.filter((t) => t.frequency === 'once' && !t.is_done);
  const overdueOnce = pendingOnce.filter((t) => formatDueDate(t.due_date, now)?.overdue);
  const recurringDoneNow = recurringTasks.filter((t) => isPetCareDoneNow(t, now)).length;

  const bestStreakTask = recurringTasks.reduce<PetCareTask | null>(
    (best, t) => (!best || t.streak_count > best.streak_count ? t : best),
    null
  );
  const streakCaption = bestStreakTask ? formatCareStreak(bestStreakTask) : null;

  if (overdueOnce.length > 0) {
    return {
      emoji: '😟',
      label: 'Needs love',
      caption: `${overdueOnce.length} task${overdueOnce.length === 1 ? '' : 's'} overdue`,
      color: OVERDUE_COLOR,
    };
  }

  // Nothing overdue and nothing recurring to track (either no tasks at
  // all besides one-offs, or all of them already done/upcoming) — as
  // good as it gets.
  if (recurringTasks.length === 0) {
    return {
      emoji: '🤩',
      label: 'Thriving',
      caption: pendingOnce.length > 0 ? `${pendingOnce.length} upcoming task${pendingOnce.length === 1 ? '' : 's'}` : 'All caught up',
      color: THRIVING_COLOR,
    };
  }

  const ratio = recurringDoneNow / recurringTasks.length;
  const careCaption = `${recurringDoneNow} of ${recurringTasks.length} routines on track`;

  if (ratio >= 0.8) {
    return { emoji: '🤩', label: 'Thriving', caption: streakCaption ?? careCaption, color: THRIVING_COLOR };
  }
  if (ratio >= 0.5) {
    return { emoji: '🙂', label: 'Content', caption: streakCaption ?? careCaption, color: theme.textSecondary };
  }
  return { emoji: '😕', label: 'Could use more care', caption: careCaption, color: OVERDUE_COLOR };
}

/** Buckets a flat task list by pet_id, pending-before-done within each
 * bucket. Called once for the unfiltered list (mood) and once for the
 * "My tasks"-filtered list (what actually renders). */
function groupTasksByPet(taskList: PetCareTask[]): Map<string, PetCareTask[]> {
  const map = new Map<string, PetCareTask[]>();
  for (const task of taskList) {
    const bucket = map.get(task.pet_id);
    if (bucket) bucket.push(task);
    else map.set(task.pet_id, [task]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const aDone = isPetCareDoneNow(a);
      const bDone = isPetCareDoneNow(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.created_at.localeCompare(b.created_at);
    });
  }
  return map;
}

export function PetsSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { members } = useHousehold();
  const { pets, loading: petsLoading, uploadingAvatarId, addPet, updatePet, deletePet, pickAndUploadPetAvatar, removePetAvatar } =
    usePets();
  const { tasks, loading: tasksLoading, currentUserId, addTask, updateTask, toggleTask, deleteTask } = usePetCare();
  const { addItemsToActiveList } = useGrocery();
  const scrollRef = useRef<ScrollView>(null);

  // Add/edit-pet composer.
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState<string | null>(null);
  const [petBreed, setPetBreed] = useState('');
  const [petAgeYears, setPetAgeYears] = useState('');
  const [petNotes, setPetNotes] = useState('');
  const [petComposerFocused, setPetComposerFocused] = useState(false);
  const petComposerBlur = useDelayedBlur(setPetComposerFocused);
  const [petSubmitting, setPetSubmitting] = useState(false);
  const isPetComposerExpanded = petComposerFocused || petName.trim().length > 0 || editingPetId !== null;

  // Only one pet's care-task composer is open at a time — opened
  // explicitly via a button tap rather than on focus, so there's no pill
  // that could get stolen out from under a synchronous blur-collapse.
  const [taskComposerPetId, setTaskComposerPetId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskFrequency, setTaskFrequency] = useState<PetCareFrequency>('once');
  const [taskAssignedTo, setTaskAssignedTo] = useState<string | null>(null);
  const [taskDueDate, setTaskDueDate] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // One shopping-list quick-add input per pet.
  const [supplyDrafts, setSupplyDrafts] = useState<Record<string, string>>({});
  const [supplyAddingId, setSupplyAddingId] = useState<string | null>(null);

  // Same "All/My" toggle Chores uses, only shown once there's more than one
  // member — filters which tasks render (and the header's done count)
  // without touching the mood computation below, which always reflects a
  // pet's full care picture regardless of who's looking.
  const [showMineOnly, setShowMineOnly] = useState(false);

  const [dazzlingIds, setDazzlingIds] = useState<Set<string>>(new Set());
  const [xpPopups, setXpPopups] = useState<{ id: string; taskId: string; amount: number }[]>([]);
  const nextPopupId = useRef(0);
  const dazzleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = dazzleTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  function resetPetForm() {
    setEditingPetId(null);
    setPetName('');
    setPetSpecies(null);
    setPetBreed('');
    setPetAgeYears('');
    setPetNotes('');
  }

  function startEditPet(pet: Pet) {
    setEditingPetId(pet.id);
    setPetName(pet.name);
    setPetSpecies(pet.species);
    setPetBreed(pet.breed ?? '');
    setPetAgeYears(ageYearsFromBirthDate(pet.birth_date));
    setPetNotes(pet.notes ?? '');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handlePetSubmit() {
    if (!petName.trim()) return;
    const editingPet = editingPetId ? pets.find((p) => p.id === editingPetId) : null;
    const trimmedAge = petAgeYears.trim();
    let birthDate: string | null;
    if (!trimmedAge) {
      birthDate = null;
    } else if (editingPet && ageYearsFromBirthDate(editingPet.birth_date) === trimmedAge) {
      // Age field wasn't actually touched — keep the precise stored date
      // rather than recomputing "today minus N years" and drifting it a
      // little further every time the pet is saved for an unrelated edit.
      birthDate = editingPet.birth_date;
    } else {
      birthDate = birthDateFromAgeYears(Number(trimmedAge));
    }

    const input: PetInput = {
      name: petName,
      species: petSpecies,
      breed: petBreed.trim() || null,
      birthDate,
      notes: petNotes.trim() || null,
    };
    setPetSubmitting(true);
    try {
      if (editingPet) {
        await updatePet(editingPet, input);
      } else {
        await addPet(input);
      }
      resetPetForm();
    } catch (err) {
      showAlert(editingPetId ? "Couldn't save changes" : "Couldn't add pet", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPetSubmitting(false);
    }
  }

  async function handleAvatarPress(pet: Pet) {
    try {
      await pickAndUploadPetAvatar(pet);
    } catch (err) {
      showAlert("Couldn't update photo", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleRemoveAvatar(pet: Pet) {
    try {
      await removePetAvatar(pet);
    } catch (err) {
      showAlert("Couldn't remove photo", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeletePet(pet: Pet) {
    showAlert('Delete pet', `Remove "${pet.name}" and all of their care tasks?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingPetId === pet.id) resetPetForm();
          deletePet(pet).catch((err) => {
            showAlert("Couldn't delete pet", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  function resetTaskForm() {
    setTaskComposerPetId(null);
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskFrequency('once');
    setTaskAssignedTo(null);
    setTaskDueDate(null);
  }

  function openTaskComposer(petId: string) {
    resetTaskForm();
    setTaskComposerPetId(petId);
  }

  function startEditTask(task: PetCareTask) {
    setTaskComposerPetId(task.pet_id);
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskFrequency(task.frequency);
    setTaskAssignedTo(task.assigned_to);
    setTaskDueDate(task.due_date);
  }

  async function handleTaskSubmit() {
    if (!taskComposerPetId || !taskTitle.trim()) return;
    const input: PetCareTaskInput = { title: taskTitle, frequency: taskFrequency, assignedTo: taskAssignedTo, dueDate: taskDueDate };
    setTaskSubmitting(true);
    try {
      if (editingTaskId) {
        const task = tasks.find((t) => t.id === editingTaskId);
        if (task) await updateTask(task, input);
      } else {
        await addTask(taskComposerPetId, input);
      }
      resetTaskForm();
    } catch (err) {
      showAlert(editingTaskId ? "Couldn't save changes" : "Couldn't add care task", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function handleToggleTask(task: PetCareTask) {
    const completingOnce = task.frequency === 'once' && !task.is_done;
    if (completingOnce) {
      setDazzlingIds((prev) => new Set(prev).add(task.id));
      const existingTimer = dazzleTimers.current.get(task.id);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setDazzlingIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        dazzleTimers.current.delete(task.id);
      }, DAZZLE_MS);
      dazzleTimers.current.set(task.id, timer);
    }

    try {
      const xpDelta = await toggleTask(task);
      if (xpDelta > 0) {
        const popupId = String(nextPopupId.current++);
        setXpPopups((prev) => [...prev, { id: popupId, taskId: task.id, amount: xpDelta }]);
      }
    } catch (err) {
      showAlert("Couldn't update care task", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function removePopup(popupId: string) {
    setXpPopups((prev) => prev.filter((p) => p.id !== popupId));
  }

  function confirmDeleteTask(task: PetCareTask) {
    showAlert('Delete care task', `Remove "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingTaskId === task.id) resetTaskForm();
          deleteTask(task).catch((err) => {
            showAlert("Couldn't delete care task", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  async function handleAddSupply(pet: Pet) {
    const draft = (supplyDrafts[pet.id] ?? '').trim();
    if (!draft) return;
    setSupplyAddingId(pet.id);
    try {
      const added = await addItemsToActiveList([{ name: draft, quantity: null, category: 'pets' }]);
      setSupplyDrafts((prev) => ({ ...prev, [pet.id]: '' }));
      if (added === 0) {
        showAlert('Already on the list', `"${draft}" is already on your grocery list.`);
      }
    } catch (err) {
      showAlert("Couldn't add to shopping list", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSupplyAddingId(null);
    }
  }

  // Grouped once from the full, unfiltered task list — used for each
  // pet's mood, which should always reflect their whole care picture
  // regardless of who's currently looking at "My tasks".
  const tasksByPet = useMemo(() => groupTasksByPet(tasks), [tasks]);

  // "My tasks" only affects what actually renders/counts, not the mood.
  const filteredTasks = useMemo(
    () => (showMineOnly ? tasks.filter((t) => t.assigned_to === currentUserId) : tasks),
    [tasks, showMineOnly, currentUserId]
  );
  const filteredTasksByPet = useMemo(() => groupTasksByPet(filteredTasks), [filteredTasks]);

  // A finished one-off task has nothing left to track — it drops off the
  // visible count entirely (though it's still in the database), unless
  // it's mid-dazzle, mirroring the chores list's behavior exactly.
  const visibleTaskCount = useMemo(
    () => filteredTasks.filter((t) => !(t.frequency === 'once' && t.is_done) || dazzlingIds.has(t.id)),
    [filteredTasks, dazzlingIds]
  );
  const totalVisible = visibleTaskCount.length;
  const totalDone = useMemo(() => visibleTaskCount.filter((t) => isPetCareDoneNow(t)).length, [visibleTaskCount]);

  function renderTaskRow(task: PetCareTask) {
    const done = isPetCareDoneNow(task);
    if (task.frequency === 'once' && task.is_done && !dazzlingIds.has(task.id)) return null;

    const assignee = members.find((m) => m.user_id === task.assigned_to)?.profile?.full_name;
    const completerName =
      task.completed_by === currentUserId ? 'you' : members.find((m) => m.user_id === task.completed_by)?.profile?.full_name;
    const meta = buildMeta(task, assignee, completerName);
    const isDazzling = dazzlingIds.has(task.id);
    const popupsForRow = xpPopups.filter((p) => p.taskId === task.id);

    return (
      <Animated.View key={task.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView
          type="background"
          style={[styles.taskRow, editingTaskId === task.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          {isDazzling && <SparkleBurst />}
          <View style={styles.checkboxSlot}>
            <Checkbox checked={done} onToggle={() => handleToggleTask(task)} />
            {popupsForRow.map((p) => (
              <XpPopup key={p.id} amount={p.amount} onDone={() => removePopup(p.id)} />
            ))}
          </View>
          <Pressable style={styles.taskTextWrapper} onPress={() => startEditTask(task)}>
            <ThemedText type="default" themeColor={done ? 'textSecondary' : 'text'} style={done && styles.doneText}>
              {task.title}
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
          <Pressable onPress={() => confirmDeleteTask(task)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderTaskComposer(petId: string) {
    return (
      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="background" style={styles.taskComposer}>
          <View style={styles.editingRow}>
            <ThemedText type="smallBold">{editingTaskId ? 'Edit care task' : 'New care task'}</ThemedText>
            <Pressable onPress={resetTaskForm} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="e.g. Feed, Walk, Vet checkup…"
            placeholderTextColor={theme.textSecondary}
            value={taskTitle}
            onChangeText={setTaskTitle}
            onSubmitEditing={handleTaskSubmit}
            autoFocus
            returnKeyType="done"
          />

          {!editingTaskId && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {QUICK_TASKS.map((qt) => (
                <Pressable
                  key={qt.label}
                  onPress={() => {
                    setTaskTitle(qt.label);
                    setTaskFrequency(qt.frequency);
                    if (qt.frequency !== 'once') setTaskDueDate(null);
                  }}
                  style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {qt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => {
                  setTaskFrequency(f.value);
                  if (f.value !== 'once') setTaskDueDate(null);
                }}
                style={[
                  styles.pill,
                  { backgroundColor: theme.backgroundSelected },
                  taskFrequency === f.value && { backgroundColor: theme.accent },
                ]}>
                <ThemedText type="small" themeColor={taskFrequency === f.value ? 'background' : 'textSecondary'}>
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {taskFrequency === 'once' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {DUE_DATE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setTaskDueDate(opt.value)}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.backgroundSelected },
                    taskDueDate === opt.value && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText type="small" themeColor={taskDueDate === opt.value ? 'background' : 'textSecondary'}>
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
                    onPress={() => setTaskAssignedTo((prev) => (prev === m.user_id ? null : m.user_id))}
                    style={[
                      styles.avatar,
                      { backgroundColor: theme.backgroundSelected },
                      taskAssignedTo === m.user_id && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={taskAssignedTo === m.user_id ? 'background' : 'text'}>
                      {initials(m.profile?.full_name)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.addButton, { backgroundColor: theme.accent, opacity: taskTitle.trim() && !taskSubmitting ? 1 : 0.5 }]}
            disabled={!taskTitle.trim() || taskSubmitting}
            onPress={handleTaskSubmit}>
            <ThemedText type="smallBold" themeColor="background">
              {editingTaskId ? 'Save changes' : 'Add task'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  function renderPetCard(pet: Pet) {
    // Mood always reflects the pet's whole care picture, unaffected by
    // "My tasks" — the visible list is what that filter actually changes.
    const petTasksAll = tasksByPet.get(pet.id) ?? [];
    const petTasksFiltered = filteredTasksByPet.get(pet.id) ?? [];
    const visibleTasks = petTasksFiltered.filter((t) => !(t.frequency === 'once' && t.is_done) || dazzlingIds.has(t.id));
    const age = formatPetAge(pet.birth_date);
    const caption = [pet.species, pet.breed, age].filter(Boolean).join(' · ');
    const mood = computePetMood(petTasksAll, theme);

    return (
      <ThemedView key={pet.id} type="backgroundElement" style={styles.petCard}>
        <View style={styles.petHeaderRow}>
          <Pressable onPress={() => handleAvatarPress(pet)} style={styles.avatarWrapper} hitSlop={4}>
            <Avatar url={pet.avatar_url} name={pet.name} size={48} />
            {uploadingAvatarId === pet.id && (
              <ActivityIndicator color={theme.accent} style={StyleSheet.absoluteFill} />
            )}
          </Pressable>
          <Pressable style={styles.petTitleWrapper} onPress={() => startEditPet(pet)}>
            <ThemedText type="default" style={styles.petName}>
              {speciesEmoji(pet.species)} {pet.name}
            </ThemedText>
            {caption ? (
              <ThemedText type="small" themeColor="textSecondary">
                {caption}
              </ThemedText>
            ) : null}
            {mood && (
              <ThemedText type="small" style={{ color: mood.color }}>
                {mood.emoji} {mood.label} · {mood.caption}
              </ThemedText>
            )}
          </Pressable>
          <Pressable onPress={() => confirmDeletePet(pet)} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </View>

        {pet.notes ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.notesText}>
            📝 {pet.notes}
          </ThemedText>
        ) : null}

        <View style={styles.supplyRow}>
          <TextInput
            style={[styles.supplyInput, { color: theme.text, backgroundColor: theme.background }]}
            placeholder={`Add to shopping list for ${pet.name}…`}
            placeholderTextColor={theme.textSecondary}
            value={supplyDrafts[pet.id] ?? ''}
            onChangeText={(text) => setSupplyDrafts((prev) => ({ ...prev, [pet.id]: text }))}
            onSubmitEditing={() => handleAddSupply(pet)}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => handleAddSupply(pet)}
            disabled={!supplyDrafts[pet.id]?.trim() || supplyAddingId === pet.id}
            style={[
              styles.supplyAddButton,
              { backgroundColor: theme.accent, opacity: supplyDrafts[pet.id]?.trim() ? 1 : 0.5 },
            ]}>
            <ThemedText type="smallBold" themeColor="background">
              🐾 Add
            </ThemedText>
          </Pressable>
        </View>

        {visibleTasks.length > 0 ? (
          <View style={styles.taskList}>{visibleTasks.map(renderTaskRow)}</View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.petEmptyText}>
            {petTasksAll.length === 0
              ? `No care tasks yet for ${pet.name} — add one below.`
              : showMineOnly
                ? `No tasks assigned to you for ${pet.name}.`
                : `${pet.name} is all caught up!`}
          </ThemedText>
        )}

        {taskComposerPetId === pet.id ? (
          renderTaskComposer(pet.id)
        ) : (
          <Pressable onPress={() => openTaskComposer(pet.id)} style={styles.addTaskLink} hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              + Add care task
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  const loading = petsLoading || tasksLoading;

  return (
    <View style={styles.container}>
      <PetsPawBackground />
      <View style={styles.header}>
        <BackButton label="Home" onPress={onBack} />
        {totalVisible > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {totalDone} of {totalVisible} done
          </ThemedText>
        )}
      </View>

      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="backgroundElement" style={styles.addCard}>
          {editingPetId && (
            <View style={styles.editingRow}>
              <ThemedText type="smallBold">Edit pet</ThemedText>
              <Pressable onPress={resetPetForm} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          )}

          {editingPetId &&
            (() => {
              const editingPet = pets.find((p) => p.id === editingPetId);
              if (!editingPet) return null;
              return (
                <View style={styles.avatarEditRow}>
                  <Pressable onPress={() => handleAvatarPress(editingPet)} style={styles.avatarWrapper} hitSlop={4}>
                    <Avatar url={editingPet.avatar_url} name={petName} size={64} />
                    {uploadingAvatarId === editingPet.id && (
                      <ActivityIndicator color={theme.accent} style={StyleSheet.absoluteFill} />
                    )}
                  </Pressable>
                  {editingPet.avatar_url && (
                    <Pressable onPress={() => handleRemoveAvatar(editingPet)} hitSlop={8}>
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
            placeholder="Add a pet…"
            placeholderTextColor={theme.textSecondary}
            value={petName}
            onChangeText={setPetName}
            onSubmitEditing={handlePetSubmit}
            onFocus={petComposerBlur.onFocus}
            onBlur={petComposerBlur.onBlur}
            returnKeyType="done"
          />

          {isPetComposerExpanded && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {SPECIES_OPTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setPetSpecies((prev) => (prev === s ? null : s))}
                    style={[
                      styles.pill,
                      { backgroundColor: theme.backgroundSelected },
                      petSpecies === s && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={petSpecies === s ? 'background' : 'textSecondary'}>
                      {s}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Breed (optional)"
                placeholderTextColor={theme.textSecondary}
                value={petBreed}
                onChangeText={setPetBreed}
                onSubmitEditing={handlePetSubmit}
                onFocus={petComposerBlur.onFocus}
                onBlur={petComposerBlur.onBlur}
                returnKeyType="done"
              />

              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Age in years (optional)"
                placeholderTextColor={theme.textSecondary}
                value={petAgeYears}
                onChangeText={(text) => setPetAgeYears(text.replace(/[^0-9]/g, ''))}
                onFocus={petComposerBlur.onFocus}
                onBlur={petComposerBlur.onBlur}
                keyboardType="numeric"
                returnKeyType="done"
              />

              <TextInput
                style={[styles.input, styles.notesInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                placeholder="Notes — allergies, vet info, feeding quirks… (optional)"
                placeholderTextColor={theme.textSecondary}
                value={petNotes}
                onChangeText={setPetNotes}
                onFocus={petComposerBlur.onFocus}
                onBlur={petComposerBlur.onBlur}
                multiline
              />

              <Pressable
                style={[styles.addButton, { backgroundColor: theme.accent, opacity: petName.trim() && !petSubmitting ? 1 : 0.5 }]}
                disabled={!petName.trim() || petSubmitting}
                onPress={handlePetSubmit}>
                <ThemedText type="smallBold" themeColor="background">
                  {editingPetId ? 'Save changes' : 'Add pet'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </Animated.View>

      {members.length > 1 && tasks.length > 0 && (
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
                {f === 'all' ? 'All tasks' : 'My tasks'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {loading && pets.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && pets.length === 0 && (
          <View style={styles.emptyState}>
            <PetsIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No pets yet — add one above to start tracking feeding, walks, vet visits, and more.
            </ThemedText>
          </View>
        )}

        <View style={styles.petsColumn}>{pets.map(renderPetCard)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addCard: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.one },
  pillRow: { flexGrow: 0 },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    marginRight: Spacing.two,
  },
  assigneeRow: { gap: Spacing.one },
  assigneeAvatars: { flexDirection: 'row', gap: Spacing.two },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  filterRow: { flexDirection: 'row' },
  list: { flex: 1 },
  listContent: { gap: Spacing.two, paddingBottom: Spacing.four },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  petsColumn: { gap: Spacing.three },
  petCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.three },
  petHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, justifyContent: 'space-between' },
  petTitleWrapper: { flex: 1, gap: Spacing.half },
  petName: { fontWeight: '700' },
  avatarWrapper: { position: 'relative' },
  avatarEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  notesText: { fontStyle: 'italic' },
  petEmptyText: { paddingVertical: Spacing.one },
  notesInput: { minHeight: 60, textAlignVertical: 'top', borderRadius: Spacing.two, paddingHorizontal: Spacing.two },
  supplyRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  supplyInput: { flex: 1, minWidth: 0, fontSize: 14, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  supplyAddButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  taskList: { gap: Spacing.two },
  taskComposer: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  addTaskLink: { paddingVertical: Spacing.one },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  checkboxSlot: { position: 'relative' },
  taskTextWrapper: { flex: 1, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
});
