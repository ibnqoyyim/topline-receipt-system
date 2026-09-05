import { paymentMethodLabel } from '../../shared/format'
import { formatNaira, formatOutstanding } from '../../shared/money'
import type { BranchInfo, ReportsData } from '../../shared/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReportsHtml(branch: BranchInfo, data: ReportsData): string {
  const salesRows = data.sales
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.cashierName)}</td>
        <td class="num">${row.receiptCount}</td>
        <td class="num">${escapeHtml(formatNaira(row.totalKobo))}</td>
        <td class="num">${escapeHtml(formatNaira(row.paidKobo))}</td>
      </tr>`
    )
    .join('')

  const outstandingRows = data.outstanding
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.phone)}</td>
        <td class="num">${escapeHtml(formatOutstanding(row.balanceKobo))}</td>
      </tr>`
    )
    .join('')

  const productRows = data.productSales
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.description)}</td>
        <td class="num">${row.qty}</td>
        <td class="num">${escapeHtml(formatNaira(row.totalKobo))}</td>
      </tr>`
    )
    .join('')

  const paymentRows = data.payments
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(paymentMethodLabel(row.method))}</td>
        <td class="num">${row.count}</td>
        <td class="num">${escapeHtml(formatNaira(row.totalKobo))}</td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reports ${escapeHtml(data.fromDate)} to ${escapeHtml(data.toDate)}</title>
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
  </style>
</head>
<body>
  <h1>${escapeHtml(branch.name)}</h1>
  <p class="muted">Reports ${escapeHtml(data.fromDate)} to ${escapeHtml(data.toDate)}
  ${data.ownShiftOnly ? ' · Own shift only' : ''}</p>
  <h2>Sales · ${escapeHtml(formatNaira(data.salesTotalKobo))}</h2>
  <table>
    <thead><tr><th>Date</th><th>Cashier</th><th class="num">Receipts</th><th class="num">Sales</th><th class="num">Paid</th></tr></thead>
    <tbody>${salesRows || '<tr><td colspan="5">No sales in this range.</td></tr>'}</tbody>
  </table>
  ${
    data.ownShiftOnly
      ? ''
      : `<h2>Outstanding balances</h2>
  <table>
    <thead><tr><th>Customer</th><th>Phone</th><th class="num">Owes</th></tr></thead>
    <tbody>${outstandingRows || '<tr><td colspan="3">No outstanding balances.</td></tr>'}</tbody>
  </table>`
  }
  <h2>Product sales</h2>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Extend</th></tr></thead>
    <tbody>${productRows || '<tr><td colspan="3">No product sales in this range.</td></tr>'}</tbody>
  </table>
  <h2>Payment methods</h2>
  <table>
    <thead><tr><th>Method</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
    <tbody>${paymentRows || '<tr><td colspan="3">No payments in this range.</td></tr>'}</tbody>
  </table>
</body>
</html>`
}
