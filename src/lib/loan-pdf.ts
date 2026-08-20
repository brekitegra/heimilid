import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatCurrency } from '@/lib/currency-format';
import { computeLoanSchedule } from '@/lib/loan-amortization';
import { formatLoanDuration, formatPayoffDate } from '@/lib/loan-format';
import type { Loan } from '@/types/loan';

const LOAN_TYPE_LABEL: Record<Loan['loan_type'], string> = { non_indexed: 'Non-indexed (óverðtryggð)', indexed: 'Indexed (verðtryggð)' };
const REPAYMENT_TYPE_LABEL: Record<Loan['repayment_type'], string> = { annuity: 'Equal payment', equal_principal: 'Equal principal' };

function buildScheduleHtml(loan: Loan): string {
  const schedule = computeLoanSchedule({
    principal: Number(loan.principal),
    interestRate: Number(loan.interest_rate),
    termMonths: loan.term_months,
    loanType: loan.loan_type,
    repaymentType: loan.repayment_type,
    assumedInflationRate: Number(loan.assumed_inflation_rate),
    extraMonthlyPayment: Number(loan.extra_monthly_payment),
  });
  const isIndexed = loan.loan_type === 'indexed';

  const rows = schedule.schedule
    .map(
      (m) => `<tr>
        <td>${m.month}</td>
        <td>${formatCurrency(m.payment)}</td>
        <td>${formatCurrency(m.principalPortion)}</td>
        <td>${formatCurrency(m.interestPortion)}</td>
        ${isIndexed ? `<td>${formatCurrency(m.indexationAdded)}</td>` : ''}
        <td>${formatCurrency(m.endingBalance)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2B2118; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #6B5D4C; font-size: 13px; margin-bottom: 4px; }
    .summary { margin: 16px 0; padding: 12px 16px; background: #F1E7D8; border-radius: 8px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
    th, td { padding: 4px 8px; text-align: right; border-bottom: 1px solid #E7D8C0; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #6B5D4C; font-weight: 600; }
    .estimate-note { margin-top: 12px; font-size: 11px; color: #C1633D; }
  </style>
</head>
<body>
  <h1>${loan.name}</h1>
  <div class="meta">${LOAN_TYPE_LABEL[loan.loan_type]} · ${REPAYMENT_TYPE_LABEL[loan.repayment_type]} · ${Number(loan.interest_rate)}% interest</div>
  <div class="meta">Figures as of ${new Date(`${loan.as_of_date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>

  <div class="summary">
    <strong>${formatCurrency(schedule.scheduledMonthlyPayment)}/mo scheduled</strong>${Number(loan.extra_monthly_payment) > 0 ? ` + ${formatCurrency(Number(loan.extra_monthly_payment))}/mo extra` : ''}<br/>
    ${formatPayoffDate(loan.as_of_date, schedule.payoffMonths)} (${formatLoanDuration(schedule.payoffMonths)})<br/>
    Total interest: ${formatCurrency(schedule.totalInterestPaid)}${isIndexed ? `<br/>Total indexation: ${formatCurrency(schedule.totalIndexationAdded)}` : ''}
  </div>

  ${isIndexed ? `<div class="estimate-note">Estimate based on a ${Number(loan.assumed_inflation_rate)}% assumed annual inflation rate — actual verðtryggð loans are recalculated periodically by your bank and may differ.</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Month</th><th>Payment</th><th>Principal</th><th>Interest</th>${isIndexed ? '<th>Indexation</th>' : ''}<th>Balance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

/** Renders a loan's full amortization schedule to a PDF and hands it to
 * the user. On iOS/Android this generates a real file and opens the
 * native share sheet (expo-print + expo-sharing). On web, expo-print has
 * no programmatic file access — printToFileAsync opens the browser's
 * print dialog instead, where the user chooses "Save as PDF" themselves;
 * this is a real platform difference, not a bug. */
export async function exportLoanScheduleAsPdf(loan: Loan): Promise<void> {
  const html = buildScheduleHtml(loan);

  if (Platform.OS === 'web') {
    // printToFileAsync resolves to undefined on web — there's no file to
    // destructure a uri from. It opens the browser's print dialog
    // directly instead, where the user picks "Save as PDF" themselves.
    await Print.printToFileAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
