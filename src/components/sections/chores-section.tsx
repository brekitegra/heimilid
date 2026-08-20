import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { Checkbox } from '@/components/checkbox';
import { ChoresIcon } from '@/components/icons/section-icons';
import { SparkleBurst } from '@/components/sparkle-burst';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isChoreDoneNow, useChores } from '@/hooks/use-chores';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useHousehold } from '@/hooks/use-household';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { formatDueDate, formatLastDone, formatStreak, isoDateInDays } from '@/lib/chore-format';
import { XpPopup } from '@/components/xp-popup';
import type { Chore, ChoreFrequency, ChoreInput } from '@/types/chore';

const FREQUENCIES: { value: ChoreFrequency; label: string }[] = [
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

const OVERDUE_COLOR = '#e5484d';
// Below this, two side-by-side boxes would be too cramped to be worth it —
// stack them instead.
const SIDE_BY_SIDE_BREAKPOINT = 700;
// How long a just-finished one-off chore lingers (flashing, sparkling)
// before it actually leaves the list.
const DAZZLE_MS = 800;

function initials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** One "· "-joined caption segment, with `warn` ones rendered in the
 * overdue color instead of the usual muted secondary tone. */
type MetaPart = { text: string; warn?: boolean };

function buildMeta(chore: Chore, assigneeName: string | null | undefined, completerName: string | null | undefined): MetaPart[] {
  const parts: MetaPart[] = [{ text: FREQUENCIES.find((f) => f.value === chore.frequency)?.label ?? '' }];
  if (assigneeName) parts.push({ text: assigneeName });

  const done = isChoreDoneNow(chore);

  if (chore.frequency === 'once') {
    if (!chore.is_done) {
      const due = formatDueDate(chore.due_date);
      if (due) parts.push({ text: due.text, warn: due.overdue });
    }
  } else {
    const streak = formatStreak(chore);
    if (streak) parts.push({ text: streak });
    if (!done) {
      const lastDone = formatLastDone(chore);
      if (lastDone) parts.push({ text: lastDone });
    }
  }

  // Who actually checked the box — not the assignee, since anyone can pitch
  // in and complete something assigned to someone else.
  if (done && completerName) parts.push({ text: `Completed by ${completerName}` });

  return parts;
}

export function ChoresSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= SIDE_BY_SIDE_BREAKPOINT;
  const { members } = useHousehold();
  const { chores, loading, currentUserId, addChore, updateChore, toggleChore, deleteChore } = useChores();
  const scrollRef = useRef<ScrollView>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<ChoreFrequency>('once');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const composerBlur = useDelayedBlur(setComposerFocused);

  // Ids of one-off chores mid-"dazzle" — kept visible (and excluded from
  // the normal done-chores-vanish rule) for a beat after completion so the
  // celebration has time to play before the row actually disappears.
  const [dazzlingIds, setDazzlingIds] = useState<Set<string>>(new Set());
  const [xpPopups, setXpPopups] = useState<{ id: string; choreId: string; amount: number }[]>([]);
  const nextPopupId = useRef(0);
  const dazzleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = dazzleTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const isComposerExpanded = composerFocused || title.trim().length > 0 || editingId !== null;

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setFrequency('once');
    setAssignedTo(null);
    setDueDate(null);
  }

  function startEdit(chore: Chore) {
    setEditingId(chore.id);
    setTitle(chore.title);
    setFrequency(chore.frequency);
    setAssignedTo(chore.assigned_to);
    setDueDate(chore.due_date);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    const input: ChoreInput = { title, frequency, assignedTo, dueDate };
    setSubmitting(true);
    try {
      if (editingId) {
        const chore = chores.find((c) => c.id === editingId);
        if (chore) await updateChore(chore, input);
      } else {
        await addChore(input);
      }
      resetForm();
    } catch (err) {
      showAlert(
        editingId ? "Couldn't save changes" : "Couldn't add chore",
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(chore: Chore) {
    const completingOnce = chore.frequency === 'once' && !chore.is_done;
    if (completingOnce) {
      setDazzlingIds((prev) => new Set(prev).add(chore.id));
      const existingTimer = dazzleTimers.current.get(chore.id);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setDazzlingIds((prev) => {
          const next = new Set(prev);
          next.delete(chore.id);
          return next;
        });
        dazzleTimers.current.delete(chore.id);
      }, DAZZLE_MS);
      dazzleTimers.current.set(chore.id, timer);
    }

    try {
      const xpDelta = await toggleChore(chore);
      if (xpDelta > 0) {
        const popupId = String(nextPopupId.current++);
        setXpPopups((prev) => [...prev, { id: popupId, choreId: chore.id, amount: xpDelta }]);
      }
    } catch (err) {
      showAlert("Couldn't update chore", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function removePopup(popupId: string) {
    setXpPopups((prev) => prev.filter((p) => p.id !== popupId));
  }

  function confirmDelete(chore: Chore) {
    showAlert('Delete chore', `Remove "${chore.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingId === chore.id) resetForm();
          deleteChore(chore).catch((err) => {
            showAlert("Couldn't delete chore", err instanceof Error ? err.message : 'Something went wrong');
          });
        },
      },
    ]);
  }

  const visibleChores = useMemo(() => {
    // A finished one-off chore has nothing left to track (no next
    // occurrence, no streak) — it's just done, so it drops off the list
    // instead of sitting there struck through forever. It's still in the
    // database (the row isn't deleted), just not shown by default — unless
    // it's still mid-dazzle, in which case it stays a beat longer.
    const notDoneOnce = chores.filter((c) => !(c.frequency === 'once' && c.is_done) || dazzlingIds.has(c.id));
    const base = showMineOnly ? notDoneOnce.filter((c) => c.assigned_to === currentUserId) : notDoneOnce;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...base].sort((a, b) => {
      const aDone = isChoreDoneNow(a);
      const bDone = isChoreDoneNow(b);
      if (aDone !== bDone) return aDone ? 1 : -1;

      if (!aDone) {
        const aOverdue = a.frequency === 'once' && !!a.due_date && new Date(a.due_date) < today;
        const bOverdue = b.frequency === 'once' && !!b.due_date && new Date(b.due_date) < today;
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

        const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (aDue !== bDue) return aDue - bDue;
      }
      return a.created_at.localeCompare(b.created_at);
    });
  }, [chores, showMineOnly, currentUserId, dazzlingIds]);

  const visibleDoneCount = useMemo(() => visibleChores.filter((c) => isChoreDoneNow(c)).length, [visibleChores]);

  // Light-touch grouping: routines (recurring) vs one-time errands. Once
  // there's ever been a chore, both boxes are a permanent fixture — each
  // shows its own "nothing here" placeholder rather than disappearing, so
  // the layout doesn't shift around based on what's currently in it.
  const routineChores = visibleChores.filter((c) => c.frequency !== 'once');
  const oneTimeChores = visibleChores.filter((c) => c.frequency === 'once');
  const showGroupBoxes = chores.length > 0;

  function renderChoreRow(chore: Chore) {
    const done = isChoreDoneNow(chore);
    const assignee = members.find((m) => m.user_id === chore.assigned_to)?.profile?.full_name;
    const completerName =
      chore.completed_by === currentUserId
        ? 'you'
        : members.find((m) => m.user_id === chore.completed_by)?.profile?.full_name;
    const meta = buildMeta(chore, assignee, completerName);
    const isDazzling = dazzlingIds.has(chore.id);
    const popupsForRow = xpPopups.filter((p) => p.choreId === chore.id);

    return (
      <Animated.View key={chore.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView
          type="backgroundElement"
          style={[styles.choreRow, editingId === chore.id && { borderColor: theme.accent, borderWidth: 1 }]}
          testID={`chore-row-${chore.id}`}>
          {isDazzling && <SparkleBurst />}
          <View style={styles.checkboxSlot}>
            <Checkbox checked={done} onToggle={() => handleToggle(chore)} testID={`chore-checkbox-${chore.id}`} />
            {popupsForRow.map((p) => (
              <XpPopup key={p.id} amount={p.amount} onDone={() => removePopup(p.id)} />
            ))}
          </View>
          <Pressable style={styles.choreTextWrapper} onPress={() => startEdit(chore)}>
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
          <Pressable onPress={() => confirmDelete(chore)} hitSlop={8} testID={`chore-delete-${chore.id}`}>
            <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
              ×
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label="Home" onPress={onBack} />
        {visibleChores.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {visibleDoneCount} of {visibleChores.length} done
          </ThemedText>
        )}
      </View>

      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="backgroundElement" style={styles.addCard}>
          {editingId && (
            <View style={styles.editingRow}>
              <ThemedText type="smallBold">Edit chore</ThemedText>
              <Pressable onPress={resetForm} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          )}

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Add a chore…"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleSubmit}
            onFocus={composerBlur.onFocus}
            onBlur={composerBlur.onBlur}
            returnKeyType="done"
          />

          {isComposerExpanded && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {FREQUENCIES.map((f) => (
                  <Pressable
                    key={f.value}
                    onPress={() => {
                      setFrequency(f.value);
                      if (f.value !== 'once') setDueDate(null);
                    }}
                    style={[
                      styles.pill,
                      { backgroundColor: theme.backgroundSelected },
                      frequency === f.value && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={frequency === f.value ? 'background' : 'textSecondary'}>
                      {f.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              {frequency === 'once' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                  {DUE_DATE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.label}
                      onPress={() => setDueDate(opt.value)}
                      style={[
                        styles.pill,
                        { backgroundColor: theme.backgroundSelected },
                        dueDate === opt.value && { backgroundColor: theme.accent },
                      ]}>
                      <ThemedText type="small" themeColor={dueDate === opt.value ? 'background' : 'textSecondary'}>
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
                        onPress={() => setAssignedTo((prev) => (prev === m.user_id ? null : m.user_id))}
                        style={[
                          styles.avatar,
                          { backgroundColor: theme.backgroundSelected },
                          assignedTo === m.user_id && { backgroundColor: theme.accent },
                        ]}>
                        <ThemedText type="small" themeColor={assignedTo === m.user_id ? 'background' : 'text'}>
                          {initials(m.profile?.full_name)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.addButton, { backgroundColor: theme.accent, opacity: title.trim() && !submitting ? 1 : 0.5 }]}
                disabled={!title.trim() || submitting}
                onPress={handleSubmit}>
                <ThemedText type="smallBold" themeColor="background">
                  {editingId ? 'Save changes' : 'Add'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </Animated.View>

      {members.length > 1 && chores.length > 0 && (
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
                {f === 'all' ? 'All chores' : 'My chores'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {loading && chores.length === 0 && (
          <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />
        )}

        {!loading && chores.length === 0 && (
          <View style={styles.emptyState}>
            <ChoresIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No chores yet — add your first one above.
            </ThemedText>
          </View>
        )}

        {showGroupBoxes && (
          <View style={isWideLayout ? styles.groupsRow : styles.groupsColumn}>
            <View style={[styles.groupCard, isWideLayout && styles.groupCardFlex, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupCardHeader}>
                RECURRING
              </ThemedText>
              {routineChores.length > 0 ? (
                routineChores.map(renderChoreRow)
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.groupEmptyText}>
                  {showMineOnly ? 'No recurring chores assigned to you' : 'No recurring chores yet'}
                </ThemedText>
              )}
            </View>
            <View style={[styles.groupCard, isWideLayout && styles.groupCardFlex, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupCardHeader}>
                ONE-TIME
              </ThemedText>
              {oneTimeChores.length > 0 ? (
                oneTimeChores.map(renderChoreRow)
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.groupEmptyText}>
                  {showMineOnly ? 'No one-time chores assigned to you' : 'No one-time chores yet'}
                </ThemedText>
              )}
            </View>
          </View>
        )}
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
  groupsRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  groupsColumn: { gap: Spacing.three },
  groupCard: { borderWidth: 1, borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  groupCardFlex: { flex: 1 },
  groupCardHeader: { paddingHorizontal: Spacing.one },
  groupEmptyText: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.two },
  choreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  checkboxSlot: { position: 'relative' },
  choreTextWrapper: { flex: 1, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
});
