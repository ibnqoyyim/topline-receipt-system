import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatReceiptDate, paymentMethodLabel } from '@shared/format'
import { formatNaira } from '@shared/money'
import type { ReceiptSummary } from '@shared/types'

export function ReceiptHistoryPage(): React.JSX.Element {
  const [rows, setRows] = useState<ReceiptSummary[]>([])
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'voided'>('all')

  const [printingId, setPrintingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load(): Promise<void> {
    const list = await window.api.listReceipts({
      query,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status
    })
    setRows(list)
  }

  useEffect(() => {
    void load()
  }, [])

  async function printRow(id: number): Promise<void> {
    setPrintingId(id)
    setNotice(null)
    const result = await window.api.printReceipt(id)
    setPrintingId(null)
    setNotice(result.ok ? 'Print dialog opened for that receipt.' : result.error)
  }

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-bold text-navy">Receipt History</h1>
      <p className="text-sm text-navy/70">Search, filter, and print past receipts.</p>
      {notice ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Receipt #, customer, cashier"
          className="rounded-md border border-navy/20 px-3 py-2 text-sm"
        />
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-md border border-navy/20 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="voided">Voided</option>
        </select>
        <button type="button" onClick={() => void load()} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
            <tr>
              <th className="px-4 py-3">Receipt #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-navy/5 hover:bg-navy/5">
                <td className="px-4 py-2 font-medium">
                  <Link to={`/receipts/preview/${row.id}`} className="text-navy-mid">
                    {row.receiptNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatReceiptDate(row.receiptDate)}</td>
                <td className="px-4 py-2">{row.customerName}</td>
                <td className="px-4 py-2">{row.cashierName}</td>
                <td className="px-4 py-2">{paymentMethodLabel(row.paymentMethod)}</td>
                <td className="px-4 py-2 text-right">{formatNaira(row.totalKobo)}</td>
                <td className="px-4 py-2 uppercase">{row.status}</td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/receipts/preview/${row.id}`} className="mr-3 text-navy-mid">
                    Preview
                  </Link>
                  <button
                    type="button"
                    disabled={printingId === row.id}
                    onClick={() => void printRow(row.id)}
                    className="font-semibold text-gold-dark disabled:opacity-50"
                  >
                    {printingId === row.id ? 'Printing…' : 'Print'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy/50">
                  No receipts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
