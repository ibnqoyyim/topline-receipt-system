import { formatReceiptDate, paymentMethodLabel } from '@shared/format'
import { formatNaira, formatOutstanding, koboToNairaGrouped } from '@shared/money'
import type { ReceiptDetail } from '@shared/types'
import receiptMark from '../assets/topline_icon_print_bw.png'

export function ReceiptTicket({
  receipt,
  width
}: {
  receipt: ReceiptDetail
  width: '58mm' | '80mm'
}): React.JSX.Element {
  const mm = width === '58mm' ? 220 : 300

  return (
    <div
      className="relative mx-auto bg-white text-black shadow-md"
      style={{
        width: mm,
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: width === '58mm' ? 12 : 14,
        padding: '12px 10px 20px'
      }}
    >
      {receipt.status === 'voided' ? (
        <div className="pointer-events-none absolute left-0 right-0 top-1/3 rotate-[-18deg] text-center text-5xl font-bold text-black/20">
          VOID
        </div>
      ) : receipt.adjusted ? (
        <div className="pointer-events-none absolute left-0 right-0 top-1/3 rotate-[-18deg] text-center text-5xl font-bold text-black/20">
          ADJUSTED
        </div>
      ) : null}
      <img
        src={receiptMark}
        alt=""
        style={{ display: 'block', width: 36, height: 36, margin: '0 auto 8px' }}
      />
      <div className="text-center text-[1.15em] font-bold uppercase leading-tight">{receipt.branch.name}</div>
      <p className="mt-1 text-center font-bold leading-snug">{receipt.branch.address}</p>
      <p className="text-center font-bold">TEL: {receipt.branch.phone}</p>
      <p className="text-center font-bold">EMAIL: {receipt.branch.email}</p>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="grid grid-cols-[2.4em_1fr_6.2em] font-bold">
        <div>QTY</div>
        <div>DETAILS</div>
        <div className="text-right">EXTEND</div>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      {receipt.items.map((item) => (
        <div key={item.id} className="mb-1.5 grid grid-cols-[2.4em_1fr_6.2em] items-start">
          <div>{item.qty}</div>
          <div className="break-words px-1">{item.description}</div>
          <div className="whitespace-nowrap text-right">{koboToNairaGrouped(item.lineTotalKobo)}</div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>SUB TOTAL</span>
        <span>{koboToNairaGrouped(receipt.subtotalKobo)}</span>
      </div>
      {receipt.taxKobo ? (
        <div className="flex justify-between">
          <span>TAX</span>
          <span>{koboToNairaGrouped(receipt.taxKobo)}</span>
        </div>
      ) : null}
      {receipt.discountKobo ? (
        <div className="flex justify-between">
          <span>DISCOUNT</span>
          <span>-{koboToNairaGrouped(receipt.discountKobo)}</span>
        </div>
      ) : null}
      <div className="flex justify-between font-bold">
        <span>{paymentMethodLabel(receipt.paymentMethod)}</span>
        <span>{formatNaira(receipt.amountPaidKobo)}</span>
      </div>
      <div className="mt-3 leading-5">
        <div>
          <span className="font-bold">RECEIPT#</span> {receipt.receiptNumber}
          {receipt.adjusted ? ' (ADJUSTED)' : ''}
        </div>
        <div>
          <span className="font-bold">DATE</span> {formatReceiptDate(receipt.receiptDate)}
        </div>
        <div className="mt-2 font-bold">CUSTOMER: {receipt.customerName}</div>
        <div className="mt-2">OUTSTANDING:</div>
        <div className="text-[1.15em] font-bold underline">{formatOutstanding(receipt.balanceAfterKobo)}</div>
        <div>CASHIER: {receipt.cashierName}</div>
      </div>
      <div className="mt-4 text-center">......Thanks for your patronage</div>
    </div>
  )
}
