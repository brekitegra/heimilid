import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { LoansIcon } from '@/components/icons/finance-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLoans } from '@/hooks/use-loans';
import { useLanguage, useTranslation, type TranslationKey } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { formatCurrency } from '@/lib/currency-format';
import { computeLoanSchedule, computeOverpaymentImpact, computePresentValue } from '@/lib/loan-amortization';
import { computePaidOffProgress, formatLoanDuration, formatPayoffDate, monthsToYears, yearsToMonths } from '@/lib/loan-format';
import { formatAmountInput, parseAmount, parseDecimal, sanitizeNumericInput } from '@/lib/number-format';
import { exportLoanScheduleAsPdf } from '@/lib/loan-pdf';
import type { Loan, LoanInput, LoanType, RepaymentType } from '@/types/loan';

const LOAN_TYPE_VALUES: LoanType[] = ['non_indexed', 'indexed'];
const LOAN_TYPE_KEYS: Record<LoanType, TranslationKey> = {
  non_indexed: 'loansTypeNonIndexed',
  indexed: 'loansTypeIndexed',
};

const REPAYMENT_TYPE_VALUES: RepaymentType[] = ['annuity', 'equal_principal'];
const REPAYMENT_TYPE_KEYS: Record<RepaymentType, TranslationKey> = {
  annuity: 'loansRepaymentAnnuity',
  equal_principal: 'loansRepaymentEqualPrincipal',
};

const SIDE_BY_SIDE_BREAKPOINT = 700;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Numbers straight from a loan row (or in-progress form state as strings)
 * → a fresh amortization projection. Live-recomputed on every edit, no
 * separate "Calculate" button — the math is cheap enough to just always
 * be current, unlike the one-shot TDEE calculator. */
function scheduleFor(loan: {
  principal: string;
  interestRate: string;
  termMonths: number;
  loanType: LoanType;
  repaymentType: RepaymentType;
  assumedInflationRate: string;
  extraMonthlyPayment: string;
}) {
  return computeLoanSchedule({
    principal: parseAmount(loan.principal),
    interestRate: parseDecimal(loan.interestRate),
    termMonths: loan.termMonths,
    loanType: loan.loanType,
    repaymentType: loan.repaymentType,
    assumedInflationRate: parseDecimal(loan.assumedInflationRate),
    extraMonthlyPayment: parseAmount(loan.extraMonthlyPayment),
  });
}

/** A saved loan row → the full LoanInput shape updateLoan() needs —
 * used when a save only intends to change one field (extra payment)
 * but the hook's update patch replaces every column, not a partial
 * merge. */
function loanToInput(loan: Loan): LoanInput {
  return {
    name: loan.name,
    loanType: loan.loan_type,
    repaymentType: loan.repayment_type,
    principal: Number(loan.principal),
    interestRate: Number(loan.interest_rate),
    termMonths: loan.term_months,
    assumedInflationRate: Number(loan.assumed_inflation_rate),
    extraMonthlyPayment: Number(loan.extra_monthly_payment),
    originalPrincipal: loan.original_principal !== null ? Number(loan.original_principal) : null,
    asOfDate: loan.as_of_date,
  };
}

function SummaryRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'} themeColor={accent ? 'accent' : 'text'}>
        {value}
      </ThemedText>
    </View>
  );
}

export function FinancesLoansSection({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const { language } = useLanguage();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= SIDE_BY_SIDE_BREAKPOINT;
  const { loans, loading, addLoan, updateLoan, deleteLoan } = useLoans();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [loanType, setLoanType] = useState<LoanType>('non_indexed');
  const [repaymentType, setRepaymentType] = useState<RepaymentType>('annuity');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termYears, setTermYears] = useState('');
  const [assumedInflationRate, setAssumedInflationRate] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Extra payments — a standalone explorer, not tied to the add/edit
  // composer above: pick any existing loan, see how much sooner extra
  // monthly payments would pay it off, and optionally save that amount
  // onto the loan for real. Visible once there's at least one loan.
  const [selectedExtraLoanId, setSelectedExtraLoanId] = useState<string | null>(null);
  const [extraAmountDraft, setExtraAmountDraft] = useState('');
  const [savingExtra, setSavingExtra] = useState(false);

  const termMonths = yearsToMonths(parseDecimal(termYears));

  const formSchedule = useMemo(
    () => scheduleFor({ principal, interestRate, termMonths, loanType, repaymentType, assumedInflationRate, extraMonthlyPayment: '0' }),
    [principal, interestRate, termMonths, loanType, repaymentType, assumedInflationRate]
  );
  const formPresentValue = useMemo(
    () => computePresentValue(formSchedule.schedule, parseDecimal(assumedInflationRate)),
    [formSchedule, assumedInflationRate]
  );
  const formPaidOff = useMemo(
    () => computePaidOffProgress(originalPrincipal.trim() ? parseAmount(originalPrincipal) : null, parseAmount(principal)),
    [originalPrincipal, principal]
  );

  // Falls back to the first loan whenever nothing's selected yet (or the
  // previously-selected one was deleted) — a derived value, not stored
  // state, so there's no separate effect needed just to keep it valid.
  const activeExtraLoan = (selectedExtraLoanId && loans.find((l) => l.id === selectedExtraLoanId)) || loans[0] || null;

  useEffect(() => {
    // Syncs the draft from the selected loan's saved value, same pattern
    // as Expenses' income draft — not derivable at render time since the
    // user needs to be able to type over it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExtraAmountDraft(activeExtraLoan ? formatAmountInput(String(activeExtraLoan.extra_monthly_payment)) : '');
  }, [activeExtraLoan]);

  const extraDraftAmount = parseAmount(extraAmountDraft);
  const extraDirty = activeExtraLoan ? extraDraftAmount !== Number(activeExtraLoan.extra_monthly_payment) : false;
  const extraLoanInput = activeExtraLoan
    ? {
        principal: Number(activeExtraLoan.principal),
        interestRate: Number(activeExtraLoan.interest_rate),
        termMonths: activeExtraLoan.term_months,
        loanType: activeExtraLoan.loan_type,
        repaymentType: activeExtraLoan.repayment_type,
        assumedInflationRate: Number(activeExtraLoan.assumed_inflation_rate),
      }
    : null;
  // Live-recomputed on every keystroke, same "cheap enough to always be
  // current" philosophy as scheduleFor() above — no memoization needed.
  const extraPreviewSchedule = extraLoanInput ? computeLoanSchedule({ ...extraLoanInput, extraMonthlyPayment: extraDraftAmount }) : null;
  const extraPreviewImpact = extraLoanInput ? computeOverpaymentImpact({ ...extraLoanInput, extraMonthlyPayment: extraDraftAmount }) : null;

  async function handleSaveExtra() {
    if (!activeExtraLoan) return;
    setSavingExtra(true);
    try {
      await updateLoan(activeExtraLoan, { ...loanToInput(activeExtraLoan), extraMonthlyPayment: extraDraftAmount });
    } catch (err) {
      showAlert(t('loansSaveExtraError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingExtra(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setLoanType('non_indexed');
    setRepaymentType('annuity');
    setPrincipal('');
    setInterestRate('');
    setTermYears('');
    setAssumedInflationRate('');
    setOriginalPrincipal('');
    setComposerOpen(false);
  }

  function startEdit(loan: Loan) {
    setEditingId(loan.id);
    setName(loan.name);
    setLoanType(loan.loan_type);
    setRepaymentType(loan.repayment_type);
    setPrincipal(formatAmountInput(String(loan.principal)));
    setInterestRate(String(loan.interest_rate));
    setTermYears(String(monthsToYears(loan.term_months)));
    setAssumedInflationRate(String(loan.assumed_inflation_rate));
    setOriginalPrincipal(loan.original_principal !== null ? formatAmountInput(String(loan.original_principal)) : '');
    setComposerOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim() || !principal.trim() || !interestRate.trim() || !termYears.trim()) return;
    // Editing a loan's base terms shouldn't disturb its extra payment —
    // that's managed entirely by the standalone Extra Payments section
    // below, never by this composer.
    const existingLoan = editingId ? loans.find((l) => l.id === editingId) : null;
    const input: LoanInput = {
      name,
      loanType,
      repaymentType,
      principal: parseAmount(principal),
      interestRate: parseDecimal(interestRate),
      termMonths,
      assumedInflationRate: parseDecimal(assumedInflationRate),
      extraMonthlyPayment: existingLoan ? Number(existingLoan.extra_monthly_payment) : 0,
      originalPrincipal: originalPrincipal.trim() ? parseAmount(originalPrincipal) : null,
      asOfDate: todayIso(),
    };
    setSubmitting(true);
    try {
      if (existingLoan) {
        await updateLoan(existingLoan, input);
      } else {
        await addLoan(input);
      }
      resetForm();
    } catch (err) {
      showAlert(editingId ? t('financesSaveChangesError') : t('loansAddError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(loan: Loan) {
    showAlert(t('loansDeleteTitle'), t('loansDeleteMessage', { name: loan.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (editingId === loan.id) resetForm();
          deleteLoan(loan).catch((err) => showAlert(t('loansDeleteError'), err instanceof Error ? err.message : t('genericErrorMessage')));
        },
      },
    ]);
  }

  async function handleExportPdf(loan: Loan) {
    setExportingId(loan.id);
    try {
      await exportLoanScheduleAsPdf(loan, language);
    } catch (err) {
      showAlert(t('loansExportPdfError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setExportingId(null);
    }
  }

  function renderLoanRow(loan: Loan) {
    const schedule = computeLoanSchedule({
      principal: Number(loan.principal),
      interestRate: Number(loan.interest_rate),
      termMonths: loan.term_months,
      loanType: loan.loan_type,
      repaymentType: loan.repayment_type,
      assumedInflationRate: Number(loan.assumed_inflation_rate),
      extraMonthlyPayment: Number(loan.extra_monthly_payment),
    });
    const extraMonthlyPayment = Number(loan.extra_monthly_payment);
    const overpaymentImpact = extraMonthlyPayment > 0 ? computeOverpaymentImpact({
      principal: Number(loan.principal),
      interestRate: Number(loan.interest_rate),
      termMonths: loan.term_months,
      loanType: loan.loan_type,
      repaymentType: loan.repayment_type,
      assumedInflationRate: Number(loan.assumed_inflation_rate),
      extraMonthlyPayment,
    }) : null;
    const paidOff = computePaidOffProgress(loan.original_principal, Number(loan.principal));

    return (
      <Animated.View key={loan.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(300)}>
        <ThemedView type="backgroundElement" style={[styles.loanCard, editingId === loan.id && { borderColor: theme.accent, borderWidth: 1 }]}>
          <Pressable onPress={() => startEdit(loan)}>
            <View style={styles.loanHeaderRow}>
              <ThemedText type="default">{loan.name}</ThemedText>
              <Pressable onPress={() => confirmDelete(loan)} hitSlop={8}>
                <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                  ×
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(LOAN_TYPE_KEYS[loan.loan_type])}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(REPAYMENT_TYPE_KEYS[loan.repayment_type])}
                </ThemedText>
              </View>
            </View>
            <View style={styles.loanFigureRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {formatCurrency(schedule.scheduledMonthlyPayment)}
                {language === 'is' ? '/mán' : '/mo'} · {formatCurrency(Number(loan.principal))} {language === 'is' ? 'eftir' : 'remaining'}
              </ThemedText>
            </View>
            {overpaymentImpact && (
              <ThemedText type="small" themeColor="accent">
                {t('loansExtraPaymentLine', {
                  amount: formatCurrency(extraMonthlyPayment),
                  duration: formatLoanDuration(overpaymentImpact.monthsSaved, language),
                  interest: formatCurrency(overpaymentImpact.interestSaved),
                })}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {formatPayoffDate(loan.as_of_date, schedule.payoffMonths, language)} ({formatLoanDuration(schedule.payoffMonths, language)})
            </ThemedText>
            {paidOff && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('loansSummaryPaidOffSoFar')}: {t('loansPaidSoFarValue', { amount: formatCurrency(paidOff.paidSoFar), percent: String(Math.round(paidOff.percent)) })}
              </ThemedText>
            )}
            {loan.loan_type === 'indexed' && (
              <ThemedText type="small" style={[styles.estimateNote, { color: theme.accent }]}>
                {t('loansIndexedEstimateNote', { rate: String(Number(loan.assumed_inflation_rate)) })}
              </ThemedText>
            )}
          </Pressable>
          <Pressable onPress={() => handleExportPdf(loan)} disabled={exportingId === loan.id} style={styles.exportLink} hitSlop={8}>
            {exportingId === loan.id ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <ThemedText type="small" themeColor="accent">
                {t('loansExportPdfButton')}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </Animated.View>
    );
  }

  const hasValidPreview = parseAmount(principal) > 0 && termMonths > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label={t('financesTitle')} onPress={onBack} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {composerOpen ? (
          <View style={styles.composerWrapper}>
            <View style={isWideLayout ? styles.formRow : styles.formColumn}>
              <ThemedView type="backgroundElement" style={[styles.addCard, isWideLayout && styles.formCardFlex]}>
                <View style={styles.editingRow}>
                  <ThemedText type="smallBold">{editingId ? t('loansEditTitle') : t('loansNewTitle')}</ThemedText>
                  <Pressable onPress={resetForm} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      {t('cancel')}
                    </ThemedText>
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  placeholder={t('loansNamePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />

                <View style={styles.fieldGridRow}>
                  <View style={styles.fieldHalf}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('loansAmountLabel')}
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                      placeholder="35.000.000"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      value={principal}
                      onChangeText={(v) => setPrincipal(formatAmountInput(v))}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('loansTermLabel')}
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                      placeholder="30"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={termYears}
                      onChangeText={(v) => setTermYears(sanitizeNumericInput(v))}
                    />
                  </View>
                </View>

                <View style={styles.fieldGridRow}>
                  <View style={styles.fieldHalf}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('loansInterestRateLabel')}
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                      placeholder="8,75"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={interestRate}
                      onChangeText={(v) => setInterestRate(sanitizeNumericInput(v))}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('loansInflationAssumptionLabel')}
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                      placeholder="3,9"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={assumedInflationRate}
                      onChangeText={(v) => setAssumedInflationRate(sanitizeNumericInput(v))}
                    />
                  </View>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {loanType === 'indexed' ? t('loansIndexedHelpText') : t('loansNonIndexedHelpText')}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {t('loansTypeLabel')}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                  {LOAN_TYPE_VALUES.map((typeValue) => (
                    <Pressable
                      key={typeValue}
                      onPress={() => setLoanType(typeValue)}
                      style={[styles.pill, { backgroundColor: theme.backgroundSelected }, loanType === typeValue && { backgroundColor: theme.accent }]}>
                      <ThemedText type="small" themeColor={loanType === typeValue ? 'background' : 'textSecondary'}>
                        {t(LOAN_TYPE_KEYS[typeValue])}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>

                <ThemedText type="small" themeColor="textSecondary">
                  {t('loansRepaymentLabel')}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                  {REPAYMENT_TYPE_VALUES.map((typeValue) => (
                    <Pressable
                      key={typeValue}
                      onPress={() => setRepaymentType(typeValue)}
                      style={[styles.pill, { backgroundColor: theme.backgroundSelected }, repaymentType === typeValue && { backgroundColor: theme.accent }]}>
                      <ThemedText type="small" themeColor={repaymentType === typeValue ? 'background' : 'textSecondary'}>
                        {t(REPAYMENT_TYPE_KEYS[typeValue])}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>

                <ThemedText type="small" themeColor="textSecondary">
                  {t('loansOriginalAmountLabel')}
                </ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  placeholder={t('loansOriginalAmountPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={originalPrincipal}
                  onChangeText={(v) => setOriginalPrincipal(formatAmountInput(v))}
                />

                <Pressable
                  style={[
                    styles.addButton,
                    { backgroundColor: theme.accent, opacity: name.trim() && principal.trim() && interestRate.trim() && termYears.trim() && !submitting ? 1 : 0.5 },
                  ]}
                  disabled={!name.trim() || !principal.trim() || !interestRate.trim() || !termYears.trim() || submitting}
                  onPress={handleSubmit}>
                  <ThemedText type="smallBold" themeColor="background">
                    {editingId ? t('saveChanges') : t('loansAddButton')}
                  </ThemedText>
                </Pressable>
              </ThemedView>

              {hasValidPreview && (
                <ThemedView type="backgroundSelected" style={[styles.summaryCard, isWideLayout && styles.formCardFlex]}>
                  <ThemedText type="smallBold" style={styles.summaryHeader}>
                    {t('loansSummaryHeader')}
                  </ThemedText>
                  <SummaryRow label={t('loansSummaryTotalPaid')} value={formatCurrency(formSchedule.totalPaid)} bold />
                  <SummaryRow label={t('loansSummaryPresentValue')} value={formatCurrency(formPresentValue)} />
                  <SummaryRow label={t('loansSummaryTotalInterest')} value={formatCurrency(formSchedule.totalInterestPaid)} />
                  <SummaryRow label={t('loansSummaryTotalIndexation')} value={formatCurrency(formSchedule.totalIndexationAdded)} />
                  <SummaryRow label={t('loansSummaryFirstPayment')} value={formatCurrency(formSchedule.schedule[0]?.payment ?? 0)} />
                  <SummaryRow label={t('loansSummaryLastPayment')} value={formatCurrency(formSchedule.schedule.at(-1)?.payment ?? 0)} />
                  <SummaryRow label={t('loansSummaryPaidOffBy')} value={formatPayoffDate(todayIso(), formSchedule.payoffMonths, language)} />
                  {formPaidOff && (
                    <SummaryRow
                      label={t('loansSummaryPaidOffSoFar')}
                      value={t('loansPaidSoFarValue', { amount: formatCurrency(formPaidOff.paidSoFar), percent: String(Math.round(formPaidOff.percent)) })}
                    />
                  )}
                  {loanType === 'indexed' && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.summaryNote}>
                      {t('loansIndexedSummaryNote')}
                    </ThemedText>
                  )}
                </ThemedView>
              )}
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              resetForm();
              setComposerOpen(true);
            }}
            style={styles.addLink}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('loansAddLink')}
            </ThemedText>
          </Pressable>
        )}

        {loans.length > 0 && activeExtraLoan && (
          <ThemedView type="backgroundElement" style={styles.extraCard}>
            <ThemedText type="smallBold">{t('loansExtraPaymentsHeader')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('loansExtraPaymentsIntro')}
            </ThemedText>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {loans.map((loan) => (
                <Pressable
                  key={loan.id}
                  onPress={() => setSelectedExtraLoanId(loan.id)}
                  style={[styles.pill, { backgroundColor: theme.backgroundSelected }, activeExtraLoan.id === loan.id && { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" themeColor={activeExtraLoan.id === loan.id ? 'background' : 'textSecondary'}>
                    {loan.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.extraInputRow}>
              <TextInput
                style={[styles.input, styles.extraInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder={t('loansExtraAmountPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={extraAmountDraft}
                onChangeText={(v) => setExtraAmountDraft(formatAmountInput(v))}
              />
              {extraDirty && (
                <Pressable onPress={handleSaveExtra} disabled={savingExtra} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {savingExtra ? t('saving') : t('save')}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {extraDraftAmount > 0 && extraPreviewImpact && extraPreviewSchedule && (
              <ThemedText type="small" themeColor="accent">
                {t('loansExtraPaymentImpact', {
                  amount: formatCurrency(extraDraftAmount),
                  name: activeExtraLoan.name,
                  duration: formatLoanDuration(extraPreviewImpact.monthsSaved, language),
                  interest: formatCurrency(extraPreviewImpact.interestSaved),
                  payoffDate: formatPayoffDate(activeExtraLoan.as_of_date, extraPreviewSchedule.payoffMonths, language),
                })}
              </ThemedText>
            )}
          </ThemedView>
        )}

        {loading && loans.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && loans.length === 0 && (
          <View style={styles.emptyState}>
            <LoansIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('loansEmptyState')}
            </ThemedText>
          </View>
        )}

        <View style={styles.loansColumn}>{loans.map(renderLoanRow)}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  composerWrapper: { gap: Spacing.three },
  formRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  formColumn: { gap: Spacing.three },
  formCardFlex: { flex: 1 },
  addCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  fieldGridRow: { flexDirection: 'row', gap: Spacing.two },
  // minWidth: 0 overrides the browser's default min-width:auto on flex
  // items — without it, a rendered <input>'s intrinsic size wins over
  // flex-grow and the row overflows instead of splitting evenly.
  fieldHalf: { flex: 1, minWidth: 0, gap: Spacing.half },
  // flexShrink: 1 + minWidth: 0 — see kids-section.tsx's identical
  // pillRow comment (RN's flexShrink defaults to 0 for a plain
  // ScrollView, and web's min-width:auto blocks shrinking even with
  // flexShrink set) — without both, a pill row wider than its card
  // overflows the rounded edge and clips the last pill.
  pillRow: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  addLink: { paddingVertical: Spacing.one },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  loansColumn: { gap: Spacing.three },
  loanCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.half },
  loanHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', gap: Spacing.one },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  loanFigureRow: { marginTop: Spacing.half },
  estimateNote: { fontWeight: '700' },
  exportLink: { marginTop: Spacing.two, alignItems: 'flex-start' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  summaryCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.half },
  summaryHeader: { letterSpacing: 0.5, marginBottom: Spacing.half },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.half },
  summaryNote: { marginTop: Spacing.one },
  extraCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  extraInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // minWidth: 0 — same web flexbox fix as fieldHalf above.
  extraInput: { flex: 1, minWidth: 0 },
});
