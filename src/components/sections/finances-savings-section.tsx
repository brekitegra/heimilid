import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { SavingsIcon } from '@/components/icons/finance-icons';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLanguage, useTranslation } from '@/hooks/use-language';
import { useSavings } from '@/hooks/use-savings';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { formatCurrency } from '@/lib/currency-format';
import { formatAmountInput, parseAmount } from '@/lib/number-format';
import { formatMonthDay } from '@/lib/date-locale';
import { computeProgress, computeSavedTotal, formatGoalDeadline } from '@/lib/savings-format';
import type { SavingsGoal } from '@/types/savings';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinancesSavingsSection({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const { language } = useLanguage();
  const theme = useTheme();
  const {
    goals,
    contributions,
    loading,
    addGoal,
    updateGoal,
    deleteGoal,
    addContribution,
    deleteContribution,
  } = useSavings();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');

  function resetForm() {
    setEditingId(null);
    setName('');
    setTargetAmount('');
    setTargetDate('');
    setComposerOpen(false);
  }

  function startEdit(goal: SavingsGoal) {
    setEditingId(goal.id);
    setName(goal.name);
    setTargetAmount(formatAmountInput(String(goal.target_amount)));
    setTargetDate(goal.target_date ?? '');
    setComposerOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim() || !targetAmount.trim()) return;
    const input = { name, targetAmount: parseAmount(targetAmount), targetDate: targetDate.trim() || null };
    setSubmitting(true);
    try {
      if (editingId) {
        const goal = goals.find((g) => g.id === editingId);
        if (goal) await updateGoal(goal, input);
      } else {
        await addGoal(input);
      }
      resetForm();
    } catch (err) {
      showAlert(editingId ? t('financesSaveChangesError') : t('savingsAddGoalError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(goal: SavingsGoal) {
    showAlert(t('savingsDeleteGoalTitle'), t('savingsDeleteGoalMessage', { name: goal.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (editingId === goal.id) resetForm();
          if (expandedGoalId === goal.id) setExpandedGoalId(null);
          deleteGoal(goal).catch((err) => showAlert(t('savingsDeleteGoalError'), err instanceof Error ? err.message : t('genericErrorMessage')));
        },
      },
    ]);
  }

  function resetContributionForm() {
    setContributionAmount('');
    setContributionNote('');
  }

  async function handleAddContribution(goalId: string) {
    if (!contributionAmount.trim()) return;
    try {
      await addContribution(goalId, { amount: parseAmount(contributionAmount), note: contributionNote || null, contributedAt: todayIso() });
      resetContributionForm();
    } catch (err) {
      showAlert(t('savingsAddContributionError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  function renderGoalCard(goal: SavingsGoal) {
    const savedTotal = computeSavedTotal(goal.id, contributions);
    const progress = computeProgress(goal, savedTotal);
    const deadline = formatGoalDeadline(goal.target_date, new Date(), language);
    const isExpanded = expandedGoalId === goal.id;
    const goalContributions = contributions.filter((c) => c.goal_id === goal.id);

    return (
      <Animated.View key={goal.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView type="backgroundElement" style={[styles.goalCard, editingId === goal.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          <Pressable onPress={() => setExpandedGoalId(isExpanded ? null : goal.id)}>
            <View style={styles.goalHeaderRow}>
              <ThemedText type="default">{goal.name}</ThemedText>
              <View style={styles.goalHeaderActions}>
                <Pressable onPress={() => startEdit(goal)} hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    {t('edit')}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => confirmDelete(goal)} hitSlop={8}>
                  <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                    ×
                  </ThemedText>
                </Pressable>
              </View>
            </View>
            <ProgressBar progress={progress} color={theme.accent} />
            <View style={styles.goalFigureRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {formatCurrency(savedTotal)} / {formatCurrency(goal.target_amount)} ({Math.round(progress * 100)}%)
              </ThemedText>
              {deadline && (
                <ThemedText type="small" themeColor="textSecondary">
                  {deadline}
                </ThemedText>
              )}
            </View>
          </Pressable>

          {isExpanded && (
            <View style={styles.expandedSection}>
              <View style={[styles.nestedPanel, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={styles.nestedHeader}>
                  {t('savingsContributionsHeader')}
                </ThemedText>
                {goalContributions.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('savingsNoContributions')}
                  </ThemedText>
                )}
                {goalContributions.map((c) => (
                  <View key={c.id} style={styles.contributionRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.contributionText}>
                      {formatCurrency(c.amount)} · {formatMonthDay(new Date(`${c.contributed_at}T00:00:00`), language)}
                      {c.note ? ` · ${c.note}` : ''}
                    </ThemedText>
                    <Pressable onPress={() => deleteContribution(c).catch(() => showAlert(t('savingsDeleteContributionError')))} hitSlop={8}>
                      <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                        ×
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.inlineComposerRow}>
                  <TextInput
                    style={[styles.input, styles.contributionAmountInput, { color: theme.text, backgroundColor: theme.background }]}
                    placeholder={t('savingsContributionAmountPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={contributionAmount}
                    onChangeText={(v) => setContributionAmount(formatAmountInput(v))}
                  />
                  <TextInput
                    style={[styles.input, styles.contributionNoteInput, { color: theme.text, backgroundColor: theme.background }]}
                    placeholder={t('savingsContributionNotePlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={contributionNote}
                    onChangeText={setContributionNote}
                  />
                  <Pressable
                    onPress={() => handleAddContribution(goal.id)}
                    disabled={!contributionAmount.trim()}
                    style={[styles.smallAddButton, { backgroundColor: theme.accent, opacity: contributionAmount.trim() ? 1 : 0.5 }]}>
                    <ThemedText type="smallBold" themeColor="background">
                      {t('add')}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ThemedView>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label={t('financesTitle')} onPress={onBack} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {composerOpen ? (
          <ThemedView type="backgroundElement" style={styles.addCard}>
            <View style={styles.editingRow}>
              <ThemedText type="smallBold">{editingId ? t('savingsEditGoalTitle') : t('savingsNewGoalTitle')}</ThemedText>
              <Pressable onPress={resetForm} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  {t('cancel')}
                </ThemedText>
              </Pressable>
            </View>

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('savingsGoalNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.inputsRow}>
              <TextInput
                style={[styles.input, styles.flexInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder={t('savingsTargetAmountPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={targetAmount}
                onChangeText={(v) => setTargetAmount(formatAmountInput(v))}
              />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('savingsTargetDatePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={targetDate}
              onChangeText={setTargetDate}
            />

            <Pressable
              style={[styles.addButton, { backgroundColor: theme.accent, opacity: name.trim() && targetAmount.trim() && !submitting ? 1 : 0.5 }]}
              disabled={!name.trim() || !targetAmount.trim() || submitting}
              onPress={handleSubmit}>
              <ThemedText type="smallBold" themeColor="background">
                {editingId ? t('saveChanges') : t('savingsAddGoalButton')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <Pressable
            onPress={() => {
              resetForm();
              setComposerOpen(true);
            }}
            style={styles.addLink}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('savingsAddGoalLink')}
            </ThemedText>
          </Pressable>
        )}

        {loading && goals.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && goals.length === 0 && (
          <View style={styles.emptyState}>
            <SavingsIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('savingsEmptyState')}
            </ThemedText>
          </View>
        )}

        <View style={styles.goalsColumn}>{goals.map(renderGoalCard)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  addCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  inputsRow: { flexDirection: 'row', gap: Spacing.two },
  flexInput: { flex: 1, minWidth: 0 },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  addLink: { paddingVertical: Spacing.one },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  goalsColumn: { gap: Spacing.three },
  goalCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  goalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  goalFigureRow: { flexDirection: 'row', justifyContent: 'space-between' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  expandedSection: { gap: Spacing.two, marginTop: Spacing.one },
  nestedPanel: { borderRadius: Spacing.three, padding: Spacing.two, gap: Spacing.one },
  nestedHeader: { letterSpacing: 0.5, marginBottom: Spacing.half },
  contributionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  contributionText: { flex: 1 },
  inlineComposerRow: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.one, alignItems: 'center' },
  // minWidth: 0 is required here — flex items default to min-width:auto
  // on web, so a rendered <input>'s intrinsic content width wins over
  // flex-grow/flex-basis and it refuses to shrink below that, causing
  // the row to overflow instead of dividing by the flex ratio (same
  // class of bug patched once already in the Loans composer, that time
  // via shorter placeholders — this is the actual underlying cause).
  contributionNoteInput: { flex: 2, flexBasis: 0, minWidth: 0 },
  contributionAmountInput: { flex: 1, flexBasis: 0, minWidth: 0 },
  smallAddButton: { flexShrink: 0, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
});
