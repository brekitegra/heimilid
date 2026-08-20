import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { BreakdownBar } from '@/components/breakdown-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBills } from '@/hooks/use-bills';
import { useIncome } from '@/hooks/use-income';
import { useLoans } from '@/hooks/use-loans';
import { useSavings } from '@/hooks/use-savings';
import { useTheme } from '@/hooks/use-theme';
import { monthlyEquivalent } from '@/lib/bill-format';
import { formatCurrency } from '@/lib/currency-format';
import { computeLoanSchedule } from '@/lib/loan-amortization';
import { formatPayoffDate } from '@/lib/loan-format';
import { computeSavedTotal } from '@/lib/savings-format';

const OVER_BUDGET_COLOR = '#e5484d';
const LEFTOVER_COLOR = '#2f9e44';

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Pure rollup of bills + loans — deliberately no reconciliation against
 * finance_accounts.balance (a separate, possibly-stale manual figure;
 * mixing it in would imply a reconciliation this app can't actually back
 * up). */
export function FinancesOverviewSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { bills, loading: billsLoading } = useBills();
  const { loans, loading: loansLoading } = useLoans();
  const { goals, contributions, loading: savingsLoading } = useSavings();
  const { householdTotal: householdIncome, loading: incomeLoading } = useIncome();
  const loading = billsLoading || loansLoading || savingsLoading || incomeLoading;

  const loanSchedules = useMemo(
    () =>
      loans.map((loan) => ({
        loan,
        schedule: computeLoanSchedule({
          principal: Number(loan.principal),
          interestRate: Number(loan.interest_rate),
          termMonths: loan.term_months,
          loanType: loan.loan_type,
          repaymentType: loan.repayment_type,
          assumedInflationRate: Number(loan.assumed_inflation_rate),
          extraMonthlyPayment: Number(loan.extra_monthly_payment),
        }),
      })),
    [loans]
  );

  // monthlyEquivalent converts each bill to its per-month cost regardless
  // of cadence — summing raw `amount` directly would count a yearly
  // insurance premium as if it recurred every month.
  const monthlyBillsOutflow = useMemo(() => bills.reduce((sum, b) => sum + monthlyEquivalent(b), 0), [bills]);
  const monthlyLoansOutflow = useMemo(
    () => loanSchedules.reduce((sum, { loan, schedule }) => sum + schedule.scheduledMonthlyPayment + Number(loan.extra_monthly_payment), 0),
    [loanSchedules]
  );
  const totalMonthlyOutflow = monthlyBillsOutflow + monthlyLoansOutflow;

  const totalDebtRemaining = useMemo(() => loans.reduce((sum, l) => sum + Number(l.principal), 0), [loans]);

  const pendingOneOffBills = useMemo(() => bills.filter((b) => b.frequency === 'once' && !b.is_paid), [bills]);
  const pendingOneOffTotal = useMemo(() => pendingOneOffBills.reduce((sum, b) => sum + Number(b.amount), 0), [pendingOneOffBills]);

  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + computeSavedTotal(g.id, contributions), 0),
    [goals, contributions]
  );
  const totalSavingsTarget = useMemo(() => goals.reduce((sum, g) => sum + Number(g.target_amount), 0), [goals]);

  const leftover = householdIncome - totalMonthlyOutflow;
  const hasIncome = householdIncome > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label="Finances" onPress={onBack} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {hasIncome && (
            <ThemedView type="backgroundElement" style={styles.heroCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroLabel}>
                LEFTOVER AFTER EXPENSES
              </ThemedText>
              <ThemedText type="title" style={[styles.heroValue, leftover < 0 && { color: OVER_BUDGET_COLOR }]}>
                {formatCurrency(leftover)}
              </ThemedText>
              <BreakdownBar
                segments={
                  leftover >= 0
                    ? [
                        { value: monthlyBillsOutflow, color: theme.textSecondary },
                        { value: monthlyLoansOutflow, color: theme.accent },
                        { value: leftover, color: LEFTOVER_COLOR },
                      ]
                    : [{ value: householdIncome, color: OVER_BUDGET_COLOR }]
                }
              />
              <View style={styles.legendRow}>
                <LegendDot color={theme.textSecondary} label={`Expenses ${formatCurrency(monthlyBillsOutflow)}`} />
                <LegendDot color={theme.accent} label={`Loans ${formatCurrency(monthlyLoansOutflow)}`} />
              </View>
              {leftover >= 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCurrency(householdIncome)}/mo income, {formatCurrency(monthlyBillsOutflow + monthlyLoansOutflow)}/mo committed — this is what
                  you could realistically put toward a loan as an extra payment.
                </ThemedText>
              ) : (
                <ThemedText type="small" style={{ color: OVER_BUDGET_COLOR }}>
                  Your committed expenses and loan payments exceed your household income by {formatCurrency(-leftover)}/mo.
                </ThemedText>
              )}
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.heroCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroLabel}>
              MONTHLY OUTFLOW
            </ThemedText>
            <ThemedText type="title" style={styles.heroValue}>
              {formatCurrency(totalMonthlyOutflow)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatCurrency(monthlyBillsOutflow)} in expenses · {formatCurrency(monthlyLoansOutflow)} in loan payments
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.heroCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroLabel}>
              TOTAL DEBT REMAINING
            </ThemedText>
            <ThemedText type="title" style={styles.heroValue}>
              {formatCurrency(totalDebtRemaining)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              across {loans.length} {loans.length === 1 ? 'loan' : 'loans'}
            </ThemedText>
          </ThemedView>

          {goals.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.heroCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroLabel}>
                TOTAL SAVED
              </ThemedText>
              <ThemedText type="title" style={styles.heroValue}>
                {formatCurrency(totalSaved)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                towards {formatCurrency(totalSavingsTarget)} across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
              </ThemedText>
            </ThemedView>
          )}

          {pendingOneOffBills.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {pendingOneOffBills.length} one-time {pendingOneOffBills.length === 1 ? 'expense' : 'expenses'} pending · {formatCurrency(pendingOneOffTotal)}
              </ThemedText>
            </ThemedView>
          )}

          {loanSchedules.length > 0 && (
            <View style={styles.loansSection}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHeader}>
                LOANS
              </ThemedText>
              {loanSchedules.map(({ loan, schedule }) => (
                <ThemedView key={loan.id} type="backgroundElement" style={styles.loanRow}>
                  <ThemedText type="default">{loan.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCurrency(schedule.scheduledMonthlyPayment + Number(loan.extra_monthly_payment))}/mo ·{' '}
                    {formatPayoffDate(loan.as_of_date, schedule.payoffMonths)}
                  </ThemedText>
                </ThemedView>
              ))}
            </View>
          )}

          {bills.length === 0 && loans.length === 0 && goals.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Add an expense, a loan, or a savings goal to see your household&apos;s totals here.
            </ThemedText>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  loadingSpinner: { marginTop: Spacing.six },
  heroCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.one },
  heroLabel: { letterSpacing: 0.5 },
  heroValue: { fontSize: 32, lineHeight: 38 },
  card: { borderRadius: Spacing.four, padding: Spacing.three },
  loansSection: { gap: Spacing.two },
  sectionHeader: { paddingHorizontal: Spacing.one, letterSpacing: 0.5 },
  loanRow: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.half },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.six },
  legendRow: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
});
