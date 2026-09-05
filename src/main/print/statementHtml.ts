import { formatReceiptDate, paymentMethodLabel } from '../../shared/format'
import { formatNaira, formatOutstanding } from '../../shared/money'
import type { BranchInfo, CustomerRecord, PaymentRecord, ReceiptSummary } from '../../shared/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildStatementHtml(
  branch: BranchInfo,
  customer: CustomerRecord,
  receipts: ReceiptSummary[],
  payments: PaymentRecord[]
): string {
  const receiptRows = receipts
    .map(
      (receipt) => `
      <tr>
        <td>${escapeHtml(formatReceiptDate(receipt.receiptDate))}</td>
        <td>${escapeHtml(receipt.receiptNumber)}</td>
        <td>${escapeHtml(receipt.status === 'voided' ? 'VOID' : 'Sale')}</td>
        <td class="num">${escapeHtml(formatNaira(receipt.totalKobo))}</td>
        <td class="num">${escapeHtml(formatNaira(receipt.amountPaidKobo))}</td>
        <td class="num">${escapeHtml(formatOutstanding(receipt.balanceAfterKobo))}</td>
      </tr>`
    )
    .join('')

  const paymentRows = payments
    .map(
      (payment) => `
      <tr>
        <td>${escapeHtml(formatReceiptDate(payment.paymentDate))}</td>
        <td>${escapeHtml(payment.receiptNumber ?? 'Standalone')}</td>
        <td>${escapeHtml(paymentMethodLabel(payment.method))}${payment.voidedReceipt ? ' (voided receipt)' : ''}</td>
        <td class="num">${escapeHtml(formatNaira(payment.amountKobo))}</td>
        <td>${escapeHtml(payment.recordedByName)}</td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Statement ${escapeHtml(customer.name)}</title>
  <style>
    @page { margin: 12mm; size: A4; }
    body { font-family: Arial, Helvetica, sans-serif; color: #12263a; font-size: 12px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    h2 { margin: 18px 0 6px; font-size: 14px; }
    .muted { color: #4b5d6e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #d7dde3; padding: 6px 4px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: #6b7c8a; }
    .num { text-align: right; white-space: nowrap; }
    .balance { font-size: 18px; font-weight: 700; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(branch.name)}</h1>
  <p class="muted">${escapeHtml(branch.address)}<br>Tel: ${escapeHtml(branch.phone)} · ${escapeHtml(branch.email)}</p>
  <h2>Customer statement</h2>
  <p><strong>${escapeHtml(customer.name)}</strong><br>
  ${escapeHtml(customer.phone || 'No phone')}<br>
  ${escapeHtml(customer.address || '')}</p>
  <p class="balance">Current outstanding: ${escapeHtml(formatOutstanding(customer.currentBalanceKobo))}</p>
  <h2>Receipts</h2>
  <table>
    <thead><tr><th>Date</th><th>Receipt</th><th>Type</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Outstanding after</th></tr></thead>
    <tbody>${receiptRows || '<tr><td colspan="6">No receipts.</td></tr>'}</tbody>
  </table>
  <h2>Payments</h2>
  <table>
    <thead><tr><th>Date</th><th>Linked receipt</th><th>Method</th><th class="num">Amount</th><th>Recorded by</th></tr></thead>
    <tbody>${paymentRows || '<tr><td colspan="5">No payments.</td></tr>'}</tbody>
  </table>
</body>
</html>`
}
