import { formatReceiptDate, paymentMethodLabel } from '../../shared/format'
import { formatNaira, formatOutstanding, koboToNairaGrouped } from '../../shared/money'
import type { ReceiptDetail } from '../../shared/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReceiptHtml(
  receipt: ReceiptDetail,
  width: '58mm' | '80mm',
  markSrc: string
): string {
  const mm = width === '58mm' ? 58 : 80
  const font = width === '58mm' ? '12px' : '14px'
  const voided = receipt.status === 'voided'

  const rows = receipt.items
    .map(
      (item) => `
      <div class="line">
        <div class="qty">${item.qty}</div>
        <div class="details">${escapeHtml(item.description)}</div>
        <div class="extend">${koboToNairaGrouped(item.lineTotalKobo)}</div>
      </div>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(receipt.receiptNumber)}</title>
  <style>
    @page { margin: 0; size: ${mm}mm auto; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${mm}mm;
      font-family: "Courier New", Courier, monospace;
      font-size: ${font};
      color: #000;
      background: #fff;
    }
    .ticket { padding: 3mm 3mm 8mm; position: relative; }
    .mark {
      display: block;
      width: 9mm;
      height: 9mm;
      margin: 0 auto 2mm;
      object-fit: contain;
    }
    .shop {
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.25;
      font-size: 1.15em;
      margin: 0 0 1.5mm;
    }
    .muted { text-align: center; line-height: 1.35; margin: 0; font-weight: 700; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .rule { border-top: 1px dashed #000; margin: 3mm 0; }
    .cols { display: grid; grid-template-columns: 2.4em 1fr 6.2em; font-weight: 700; margin-bottom: 1mm; }
    .line { display: grid; grid-template-columns: 2.4em 1fr 6.2em; align-items: start; margin-bottom: 1.5mm; }
    .qty { text-align: left; }
    .extend { text-align: right; white-space: nowrap; }
    .details { padding: 0 1mm; word-break: break-word; }
    .totals .row { display: flex; justify-content: space-between; margin: 1mm 0; }
    .meta { margin-top: 3mm; line-height: 1.4; }
    .outstanding { font-weight: 700; text-decoration: underline; font-size: 1.15em; margin: 1mm 0 3mm; }
    .thanks { margin-top: 4mm; }
    .watermark {
      position: absolute; inset: 30% 0 auto; text-align: center;
      font-size: 42px; font-weight: 700; opacity: 0.18; transform: rotate(-18deg);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${voided ? '<div class="watermark">VOID</div>' : ''}
    <img class="mark" src="${markSrc}" alt="" />
    <div class="shop">${escapeHtml(receipt.branch.name)}</div>
    <p class="muted">${escapeHtml(receipt.branch.address)}</p>
    <p class="muted">TEL: ${escapeHtml(receipt.branch.phone)}</p>
    <p class="muted">EMAIL: ${escapeHtml(receipt.branch.email)}</p>
    <div class="rule"></div>
    <div class="cols">
      <div>QTY</div>
      <div>DETAILS</div>
      <div class="extend">EXTEND</div>
    </div>
    <div class="rule"></div>
    ${rows}
    <div class="rule"></div>
    <div class="totals">
      <div class="row"><span>SUB TOTAL</span><span>${koboToNairaGrouped(receipt.subtotalKobo)}</span></div>
      ${receipt.taxKobo ? `<div class="row"><span>TAX</span><span>${koboToNairaGrouped(receipt.taxKobo)}</span></div>` : ''}
      ${receipt.discountKobo ? `<div class="row"><span>DISCOUNT</span><span>-${koboToNairaGrouped(receipt.discountKobo)}</span></div>` : ''}
      <div class="row bold"><span>${escapeHtml(paymentMethodLabel(receipt.paymentMethod))}</span><span>${formatNaira(receipt.amountPaidKobo)}</span></div>
    </div>
    <div class="meta">
      <div><span class="bold">RECEIPT#</span> &nbsp; ${escapeHtml(receipt.receiptNumber)}${receipt.adjusted ? ' (ADJUSTED)' : ''}</div>
      <div><span class="bold">DATE</span> &nbsp; ${escapeHtml(formatReceiptDate(receipt.receiptDate))}</div>
      <div class="bold" style="margin-top:2mm">CUSTOMER: ${escapeHtml(receipt.customerName)}</div>
      <div style="margin-top:2mm">OUTSTANDING:</div>
      <div class="outstanding">${escapeHtml(formatOutstanding(receipt.balanceAfterKobo))}</div>
      <div>CASHIER: ${escapeHtml(receipt.cashierName)}</div>
    </div>
    <div class="thanks center">......Thanks for your patronage</div>
  </div>
</body>
</html>`
}
