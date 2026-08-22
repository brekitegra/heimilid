import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatCurrency } from '@/lib/currency-format';
import { computeLoanSchedule } from '@/lib/loan-amortization';
import { formatLoanDuration, formatPayoffDate } from '@/lib/loan-format';
import { formatFullDate } from '@/lib/date-locale';
import type { Loan } from '@/types/loan';
import type { Language } from '@/hooks/use-language';

// The English label already carries the Icelandic loan-type term
// (óverðtryggð/verðtryggð) in parentheses, so the Icelandic label is the
// mirror image — the Icelandic term first, English in parentheses would
// be backwards for an Icelandic reader, so it's plain Icelandic alone.
const LOAN_TYPE_LABEL: Record<Language, Record<Loan['loan_type'], string>> = {
  en: { non_indexed: 'Non-indexed (óverðtryggð)', indexed: 'Indexed (verðtryggð)' },
  is: { non_indexed: 'Óverðtryggt', indexed: 'Verðtryggt' },
};
const REPAYMENT_TYPE_LABEL: Record<Language, Record<Loan['repayment_type'], string>> = {
  en: { annuity: 'Equal payment', equal_principal: 'Equal principal' },
  is: { annuity: 'Jafnar greiðslur', equal_principal: 'Jafnar afborganir' },
};
// PDF-specific static labels — plain strings, no hook access here (see
// chore-format.ts's doc comment), so this file branches on `language`
// directly rather than going through t().
const PDF_LABELS: Record<Language, {
  interestSuffix: string; asOfPrefix: string; scheduledSuffix: string; extraSuffix: string;
  totalInterest: string; totalIndexation: string; estimateNote: (rate: number) => string;
  yearLabel: (n: number) => string;
  colMonth: string; colPayment: string; colPrincipal: string; colExtra: string; colInterest: string; colIndexation: string; colBalance: string;
}> = {
  en: {
    interestSuffix: '% interest',
    asOfPrefix: 'Figures as of ',
    scheduledSuffix: '/mo scheduled',
    extraSuffix: '/mo extra',
    totalInterest: 'Total interest: ',
    totalIndexation: 'Total indexation: ',
    estimateNote: (rate) => `Estimate based on a ${rate}% assumed annual inflation rate — actual verðtryggð loans are recalculated periodically by your bank and may differ.`,
    yearLabel: (n) => `Year ${n}`,
    colMonth: 'Month', colPayment: 'Payment', colPrincipal: 'Principal', colExtra: 'Extra', colInterest: 'Interest', colIndexation: 'Indexation', colBalance: 'Balance',
  },
  is: {
    interestSuffix: '% vextir',
    asOfPrefix: 'Tölur miðast við ',
    scheduledSuffix: '/mán áætlað',
    extraSuffix: '/mán aukalega',
    totalInterest: 'Samtals vextir: ',
    totalIndexation: 'Samtals verðbætur: ',
    estimateNote: (rate) => `Áætlun byggð á ${rate}% forsendu um árlega verðbólgu — raunveruleg verðtryggð lán eru endurreiknuð reglulega af bankanum og geta verið frábrugðin.`,
    yearLabel: (n) => `Ár ${n}`,
    colMonth: 'Mánuður', colPayment: 'Greiðsla', colPrincipal: 'Höfuðstóll', colExtra: 'Aukagreiðsla', colInterest: 'Vextir', colIndexation: 'Verðbætur', colBalance: 'Staða',
  },
};

function buildScheduleHtml(loan: Loan, language: Language): string {
  const labels = PDF_LABELS[language];
  const hasExtra = Number(loan.extra_monthly_payment) > 0;
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
  const asOfDate = new Date(`${loan.as_of_date}T00:00:00`);
  const columnCount = 4 + (hasExtra ? 1 : 0) + (isIndexed ? 1 : 0); // month, payment, principal, interest, balance + optional extra/indexation

  // Grouped into "Year N" sections rather than one flat 360-row table —
  // this is what actually makes a 20-30 year schedule readable as a
  // year-by-year overview instead of an undifferentiated wall of rows,
  // per the explicit ask for "árs yfirlit mánuð fyrir mánuð".
  const rows = schedule.schedule
    .map((m) => {
      const monthDate = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + (m.month - 1), 1);
      const yearIndex = Math.floor((m.month - 1) / 12) + 1;
      const isFirstOfYear = (m.month - 1) % 12 === 0;
      const yearHeader = isFirstOfYear
        ? `<tr class="year-row"><td colspan="${columnCount}">${labels.yearLabel(yearIndex)} · ${monthDate.getFullYear()}</td></tr>`
        : '';
      return `${yearHeader}<tr>
        <td>${m.month}</td>
        <td>${formatCurrency(m.payment)}</td>
        <td>${formatCurrency(m.principalPortion)}</td>
        ${hasExtra ? `<td>${m.extraPortion > 0 ? formatCurrency(m.extraPortion) : '—'}</td>` : ''}
        <td>${formatCurrency(m.interestPortion)}</td>
        ${isIndexed ? `<td>${formatCurrency(m.indexationAdded)}</td>` : ''}
        <td>${formatCurrency(m.endingBalance)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 14mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1410; background: #FFFFFF; margin: 0; }
    h1 { font-size: 19px; margin: 0 0 4px; }
    .meta { color: #5C5044; font-size: 12px; margin-bottom: 2px; }
    .summary { margin: 14px 0 8px; font-size: 13px; line-height: 1.5; }
    .summary strong { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 10px; }
    th, td { padding: 3px 6px; text-align: right; border-bottom: 1px solid #E2DCD2; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #5C5044; font-weight: 600; border-bottom: 1px solid #B8AF9F; }
    tr.year-row td { text-align: left; font-weight: 700; padding-top: 10px; border-bottom: 1px solid #1A1410; color: #1A1410; }
    .estimate-note { margin-top: 10px; font-size: 10.5px; color: #8A5A38; }
  </style>
</head>
<body>
  <h1>${loan.name}</h1>
  <div class="meta">${LOAN_TYPE_LABEL[language][loan.loan_type]} · ${REPAYMENT_TYPE_LABEL[language][loan.repayment_type]} · ${Number(loan.interest_rate)}${labels.interestSuffix}</div>
  <div class="meta">${labels.asOfPrefix}${formatFullDate(asOfDate, language)}</div>

  <div class="summary">
    <strong>${formatCurrency(schedule.scheduledMonthlyPayment)}${labels.scheduledSuffix}</strong>${hasExtra ? ` + ${formatCurrency(Number(loan.extra_monthly_payment))}${labels.extraSuffix}` : ''}<br/>
    ${formatPayoffDate(loan.as_of_date, schedule.payoffMonths, language)} (${formatLoanDuration(schedule.payoffMonths, language)})<br/>
    ${labels.totalInterest}${formatCurrency(schedule.totalInterestPaid)}${isIndexed ? `<br/>${labels.totalIndexation}${formatCurrency(schedule.totalIndexationAdded)}` : ''}
  </div>

  ${isIndexed ? `<div class="estimate-note">${labels.estimateNote(Number(loan.assumed_inflation_rate))}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>${labels.colMonth}</th><th>${labels.colPayment}</th><th>${labels.colPrincipal}</th>${hasExtra ? `<th>${labels.colExtra}</th>` : ''}<th>${labels.colInterest}</th>${isIndexed ? `<th>${labels.colIndexation}</th>` : ''}<th>${labels.colBalance}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

/** Renders a loan's full amortization schedule to a PDF and hands it to
 * the user. On iOS/Android this generates a real file and opens the
 * native share sheet (expo-print + expo-sharing). On web, expo-print's
 * web shim (`ExponentPrint.web.js`) silently ignores the `{ html }`
 * option entirely and just calls the browser's native `window.print()`
 * on whatever page is currently open — so routing through
 * `Print.printToFileAsync` on web would print the live app UI (tab bar,
 * hub cards, page background and all), never the schedule built above.
 * Confirmed by reading the installed package's source, not assumed. The
 * fix is to bypass expo-print on web entirely: open a genuinely blank
 * new tab, write our own HTML into *that* document, and print it
 * instead — the tab closes itself right after via `onafterprint` (a
 * short delay covers browsers that fire it before the print dialog
 * actually opens). */
export async function exportLoanScheduleAsPdf(loan: Loan, language: Language = 'en'): Promise<void> {
  const html = buildScheduleHtml(loan, language);

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) throw new Error('Pop-up blocked — allow pop-ups for this site to export a PDF.');
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onafterprint = () => printWindow.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
