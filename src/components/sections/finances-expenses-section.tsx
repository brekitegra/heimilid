import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { Checkbox } from '@/components/checkbox';
import { CollapsibleCard } from '@/components/collapsible-card';
import { ExpensesIcon } from '@/components/icons/finance-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isBillPaidNow, useBills } from '@/hooks/use-bills';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useHousehold } from '@/hooks/use-household';
import { useIncome } from '@/hooks/use-income';
import { useLanguage, useTranslation, type Language, type TranslationKey } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { formatBillStreak, formatDueDay, formatLastPaid } from '@/lib/bill-format';
import { formatCurrency } from '@/lib/currency-format';
import { isSameName } from '@/lib/duplicate-check';
import { formatAmountInput, parseAmount, sanitizeNumericInput } from '@/lib/number-format';
import type { Bill, BillFrequency, BillInput } from '@/types/bill';

const FREQUENCY_ORDER: BillFrequency[] = ['once', 'monthly', 'yearly', 'weekly', 'daily'];

const FREQUENCY_KEYS: Record<BillFrequency, TranslationKey> = {
  once: 'frequencyOnce',
  monthly: 'frequencyMonthly',
  yearly: 'frequencyYearly',
  weekly: 'frequencyWeekly',
  daily: 'frequencyDaily',
};

const OVERDUE_COLOR = '#e5484d';
const SIDE_BY_SIDE_BREAKPOINT = 700;

/** One "· "-joined caption segment, with `warn` ones rendered in the
 * overdue color instead of the usual muted secondary tone. Mirrors
 * chores-section.tsx's buildMeta exactly. */
type MetaPart = { text: string; warn?: boolean };

function buildMeta(bill: Bill, t: ReturnType<typeof useTranslation>, language: Language): MetaPart[] {
  const parts: MetaPart[] = [{ text: t(FREQUENCY_KEYS[bill.frequency]) }];
  const paid = isBillPaidNow(bill);

  if (bill.frequency === 'once') {
    if (!bill.is_paid) {
      const due = formatDueDay(bill.due_day, new Date(), language);
      if (due) parts.push({ text: due.text, warn: due.overdue });
    }
  } else {
    const streak = formatBillStreak(bill, language);
    if (streak) parts.push({ text: streak });
    if (!paid) {
      const lastPaid = formatLastPaid(bill, new Date(), language);
      if (lastPaid) parts.push({ text: lastPaid });
    }
  }

  return parts;
}

export function FinancesExpensesSection({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const { language } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= SIDE_BY_SIDE_BREAKPOINT;
  const { bills, loading, addBill, updateBill, toggleBill, deleteBill } = useBills();
  const { members } = useHousehold();
  const { incomes, myIncome, householdTotal, savingIncome, userId, setMonthlyIncome } = useIncome();
  const scrollRef = useRef<ScrollView>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [dueDay, setDueDay] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const composerBlur = useDelayedBlur(setComposerFocused);

  const [incomeDraft, setIncomeDraft] = useState('');
  useEffect(() => {
    // Syncs the draft from the fetched/saved value, same as startEdit()
    // populating form state elsewhere in this app — not a derived value
    // computable from render, since the user needs to be able to type
    // over it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncomeDraft(myIncome ? formatAmountInput(String(myIncome.monthly_amount)) : '');
  }, [myIncome]);
  const incomeDirty = parseAmount(incomeDraft) !== Number(myIncome?.monthly_amount ?? 0);

  async function handleSaveIncome() {
    try {
      await setMonthlyIncome(parseAmount(incomeDraft));
    } catch (err) {
      showAlert(t('financesExpensesSaveIncomeError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  const isComposerExpanded = composerFocused || name.trim().length > 0 || editingId !== null;

  function resetForm() {
    setEditingId(null);
    setName('');
    setAmount('');
    setFrequency('monthly');
    setDueDay('');
    setComposerFocused(false);
  }

  function startEdit(bill: Bill) {
    setEditingId(bill.id);
    setName(bill.name);
    setAmount(formatAmountInput(String(bill.amount)));
    setFrequency(bill.frequency);
    setDueDay(bill.due_day ? String(bill.due_day) : '');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handleSubmit() {
    if (!name.trim() || !amount.trim()) return;
    const duplicate = bills.find((b) => b.id !== editingId && !isBillPaidNow(b) && isSameName(b.name, name));
    if (duplicate) {
      showAlert(t('financesExpensesDuplicateTitle'), t('financesExpensesDuplicateMessage', { name: duplicate.name }));
      return;
    }
    const input: BillInput = {
      name,
      amount: parseAmount(amount),
      accountId: null,
      dueDay: dueDay.trim() ? Number(dueDay) : null,
      frequency,
    };
    setSubmitting(true);
    try {
      if (editingId) {
        const bill = bills.find((b) => b.id === editingId);
        if (bill) await updateBill(bill, input);
      } else {
        await addBill(input);
      }
      resetForm();
    } catch (err) {
      showAlert(editingId ? t('financesSaveChangesError') : t('financesExpensesAddError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(bill: Bill) {
    try {
      await toggleBill(bill);
    } catch (err) {
      showAlert(t('financesExpensesToggleError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  function confirmDelete(bill: Bill) {
    showAlert(t('financesExpensesDeleteTitle'), t('financesExpensesDeleteMessage', { name: bill.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (editingId === bill.id) resetForm();
          deleteBill(bill).catch((err) => showAlert(t('financesExpensesDeleteError'), err instanceof Error ? err.message : t('genericErrorMessage')));
        },
      },
    ]);
  }

  const visibleBills = useMemo(() => {
    // A finished one-off expense has nothing left to track — it drops off
    // the list once paid, same as Chores' one-off items. Still in the
    // database, just not shown by default.
    return bills.filter((b) => !(b.frequency === 'once' && b.is_paid));
  }, [bills]);

  const recurringBills = visibleBills.filter((b) => b.frequency !== 'once');
  const oneTimeBills = visibleBills.filter((b) => b.frequency === 'once');
  const showGroupBoxes = bills.length > 0;

  function renderBillRow(bill: Bill) {
    const paid = isBillPaidNow(bill);
    const meta = buildMeta(bill, t, language);

    return (
      <Animated.View key={bill.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView type="backgroundElement" style={[styles.billRow, editingId === bill.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          <Checkbox checked={paid} onToggle={() => handleToggle(bill)} />
          <Pressable style={styles.billTextWrapper} onPress={() => startEdit(bill)}>
            <View style={styles.billTitleRow}>
              <ThemedText type="default" themeColor={paid ? 'textSecondary' : 'text'} style={paid && styles.doneText}>
                {bill.name}
              </ThemedText>
              <ThemedText type="default" themeColor={paid ? 'textSecondary' : 'text'}>
                {formatCurrency(Number(bill.amount))}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {meta.map((part, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary" style={part.warn && { color: OVERDUE_COLOR }}>
                  {part.text}
                  {i < meta.length - 1 ? ' · ' : ''}
                </ThemedText>
              ))}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDelete(bill)} hitSlop={8}>
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
        <BackButton label={t('financesTitle')} onPress={onBack} />
      </View>

      <CollapsibleCard title={t('financesIncomeSectionHeader')}>
        <View style={styles.incomeRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.incomeLabel}>
            {t('financesYourMonthlyIncome')}
          </ThemedText>
          <TextInput
            style={[styles.input, styles.incomeInput, { color: theme.text, backgroundColor: theme.background }]}
            placeholder={t('financesIncomeAmountPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={incomeDraft}
            onChangeText={(v) => setIncomeDraft(formatAmountInput(v))}
          />
          {incomeDirty && (
            <Pressable onPress={handleSaveIncome} disabled={savingIncome} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="accent">
                {savingIncome ? t('saving') : t('save')}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {members
          .filter((m) => m.user_id !== userId)
          .map((m) => {
            const memberIncome = incomes.find((i) => i.user_id === m.user_id);
            return (
              <View key={m.user_id} style={styles.incomeRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.incomeLabel}>
                  {m.profile?.full_name ?? t('financesHouseholdMemberFallback')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCurrency(Number(memberIncome?.monthly_amount ?? 0))}
                </ThemedText>
              </View>
            );
          })}

        <View style={[styles.incomeRow, styles.incomeTotalRow, { borderTopColor: theme.background }]}>
          <ThemedText type="smallBold">{t('financesHouseholdTotalLabel')}</ThemedText>
          <ThemedText type="smallBold">
            {formatCurrency(householdTotal)}
            {language === 'is' ? '/mán' : '/mo'}
          </ThemedText>
        </View>
      </CollapsibleCard>

      <Animated.View layout={LinearTransition.duration(200)}>
        <ThemedView type="backgroundElement" style={styles.addCard}>
          {editingId && (
            <View style={styles.editingRow}>
              <ThemedText type="smallBold">{t('financesEditExpenseTitle')}</ThemedText>
              <Pressable onPress={resetForm} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  {t('cancel')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={t('financesAddExpensePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            onFocus={composerBlur.onFocus}
            onBlur={composerBlur.onBlur}
            returnKeyType="next"
          />

          {isComposerExpanded && (
            <>
              <View style={styles.amountDueRow}>
                <TextInput
                  style={[styles.input, styles.amountInput, { color: theme.text, backgroundColor: theme.background }]}
                  placeholder={t('financesAmountPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={(v) => setAmount(formatAmountInput(v))}
                  onFocus={composerBlur.onFocus}
                  onBlur={composerBlur.onBlur}
                />
                <TextInput
                  style={[styles.input, styles.dueDayInput, { color: theme.text, backgroundColor: theme.background }]}
                  placeholder={t('financesDueDayPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={dueDay}
                  onChangeText={(v) => setDueDay(sanitizeNumericInput(v))}
                  onFocus={composerBlur.onFocus}
                  onBlur={composerBlur.onBlur}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {FREQUENCY_ORDER.map((freq) => (
                  <Pressable
                    key={freq}
                    onPressIn={composerBlur.onFocus}
                    onPress={() => setFrequency(freq)}
                    style={[styles.pill, { backgroundColor: theme.backgroundSelected }, frequency === freq && { backgroundColor: theme.accent }]}>
                    <ThemedText type="small" themeColor={frequency === freq ? 'background' : 'textSecondary'}>
                      {t(FREQUENCY_KEYS[freq])}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={[styles.addButton, { backgroundColor: theme.accent, opacity: name.trim() && amount.trim() && !submitting ? 1 : 0.5 }]}
                disabled={!name.trim() || !amount.trim() || submitting}
                onPress={handleSubmit}>
                <ThemedText type="smallBold" themeColor="background">
                  {editingId ? t('saveChanges') : t('add')}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </Animated.View>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {loading && bills.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && bills.length === 0 && (
          <View style={styles.emptyState}>
            <ExpensesIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('financesExpensesEmptyState')}
            </ThemedText>
          </View>
        )}

        {showGroupBoxes && (
          <View style={isWideLayout ? styles.groupsRow : styles.groupsColumn}>
            <View style={[styles.groupCard, isWideLayout && styles.groupCardFlex, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupCardHeader}>
                {t('financesRecurringGroupHeader')}
              </ThemedText>
              {recurringBills.length > 0 ? (
                recurringBills.map(renderBillRow)
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.groupEmptyText}>
                  {t('financesNoRecurringExpenses')}
                </ThemedText>
              )}
            </View>
            <View style={[styles.groupCard, isWideLayout && styles.groupCardFlex, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupCardHeader}>
                {t('financesOneTimeGroupHeader')}
              </ThemedText>
              {oneTimeBills.length > 0 ? (
                oneTimeBills.map(renderBillRow)
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.groupEmptyText}>
                  {t('financesNoOneTimeExpenses')}
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
  header: { flexDirection: 'row', alignItems: 'center' },
  addCard: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.one },
  amountDueRow: { flexDirection: 'row', gap: Spacing.two },
  // minWidth: 0 overrides web's default min-width:auto on flex items —
  // without it a rendered <input>'s intrinsic size wins over flex-grow
  // and the row overflows instead of splitting per the flex ratio.
  amountInput: { flex: 2, minWidth: 0, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  dueDayInput: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  // flexShrink: 1 + minWidth: 0 — see kids-section.tsx's identical
  // pillRow comment (RN's flexShrink defaults to 0 for a plain
  // ScrollView, and web's min-width:auto blocks shrinking even with
  // flexShrink set) — without both, a pill row wider than its card
  // overflows the rounded edge and clips the last pill.
  pillRow: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
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
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  // minWidth: 0 — same web flexbox fix as pillRow above: without it, a
  // long expense name won't shrink to wrap and instead overflows past
  // the card's edge.
  billTextWrapper: { flex: 1, minWidth: 0, gap: Spacing.half },
  billTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  incomeLabel: { flex: 1 },
  incomeInput: { width: 120, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, textAlign: 'right' },
  incomeTotalRow: { marginTop: Spacing.one, paddingTop: Spacing.two, borderTopWidth: 1 },
});
