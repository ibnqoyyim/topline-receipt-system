import { useEffect, useState } from 'react'
import { paymentMethodLabel, todayIsoDate } from '@shared/format'
import { formatNaira, formatOutstanding } from '@shared/money'
import type { ReportsData } from '@shared/types'

export function ReportsPage(): React.JSX.Element {
  const [fromDate, setFromDate] = useState(todayIsoDate())
  const [toDate, setToDate] = useState(todayIsoDate())
  const [data, setData] = useState<ReportsData | null>(null)

  async function load(): Promise<void> {
    setData(await window.api.getReports({ fromDate, toDate }))
  }

  useEffect(() => {
    void load()
  }, [])

  const [notice, setNotice] = useState<string | null>(null)

  async function printReport(): Promise<void> {
    const result = await window.api.printReports({ fromDate, toDate })
    setNotice(result.ok ? 'Print dialog opened for the report.' : result.error)
  }

  async function exportPdf(): Promise<void> {
    const result = await window.api.exportReportsPdf({ fromDate, toDate })
    setNotice(result.ok ? `Saved PDF: ${result.data}` : result.error)
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
          <p className="text-sm text-navy/70">
            {data?.ownShiftOnly ? 'Your shift only — sales and payments you recorded.' : 'Branch-wide sales, outstanding, products, and payments.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void load()} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
            Run
          </button>
          <button type="button" onClick={() => void printReport()} className="rounded-md border border-navy/20 px-4 py-2 text-sm font-semibold">
            Print
          </button>
          <button type="button" onClick={() => void exportPdf()} className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy-dark">
            Export PDF
          </button>
        </div>
      </div>
      {notice ? <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}

      {!data ? (
        <p className="text-navy/70">Loading…</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="font-bold text-navy">Sales {data.fromDate} to {data.toDate}</h2>
            <p className="text-sm text-navy/60">Total {formatNaira(data.salesTotalKobo)}</p>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="py-1">Date</th>
                  <th>Cashier</th>
                  <th className="text-right">Receipts</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((row, index) => (
                  <tr key={`${row.date}-${row.cashierName}-${index}`} className="border-t border-navy/5">
                    <td className="py-1">{row.date}</td>
                    <td>{row.cashierName}</td>
                    <td className="text-right">{row.receiptCount}</td>
                    <td className="text-right">{formatNaira(row.totalKobo)}</td>
                    <td className="text-right">{formatNaira(row.paidKobo)}</td>
                  </tr>
                ))}
                {data.sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-navy/50">
                      No sales in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          {!data.ownShiftOnly ? (
          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="font-bold text-navy">Outstanding balances</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="py-1">Customer</th>
                  <th>Phone</th>
                  <th className="text-right">Owes</th>
                </tr>
              </thead>
              <tbody>
                {data.outstanding.map((row) => (
                  <tr key={row.id} className="border-t border-navy/5">
                    <td className="py-1">{row.name}</td>
                    <td>{row.phone}</td>
                    <td className="text-right">{formatOutstanding(row.balanceKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          ) : null}

          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="font-bold text-navy">Product sales</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Extend</th>
                </tr>
              </thead>
              <tbody>
                {data.productSales.map((row) => (
                  <tr key={row.description} className="border-t border-navy/5">
                    <td className="py-1">{row.description}</td>
                    <td className="text-right">{row.qty}</td>
                    <td className="text-right">{formatNaira(row.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="font-bold text-navy">Payment methods</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="py-1">Method</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((row) => (
                  <tr key={row.method} className="border-t border-navy/5">
                    <td className="py-1">{paymentMethodLabel(row.method)}</td>
                    <td className="text-right">{row.count}</td>
                    <td className="text-right">{formatNaira(row.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
