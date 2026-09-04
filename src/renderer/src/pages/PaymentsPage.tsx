import { FormEvent, useEffect, useState } from 'react'
import { PAYMENT_METHODS, formatReceiptDate, paymentMethodLabel, todayIsoDate } from '@shared/format'
import { formatNaira, formatOutstanding, tryNairaToKobo } from '@shared/money'
import type { CustomerRecord, PaymentMethod, PaymentRecord } from '@shared/types'

const inputClass = 'mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold'

export function PaymentsPage(): React.JSX.Element {
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [rows, setRows] = useState<PaymentRecord[]>([])
  const [customerId, setCustomerId] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState(todayIsoDate())
  const [toDate, setToDate] = useState(todayIsoDate())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = customers.find((customer) => customer.id === customerId)

  async function load(): Promise<void> {
    const [customerRows, paymentRows] = await Promise.all([
      window.api.listCustomers(),
      window.api.listPayments({ query, fromDate, toDate })
    ])
    setCustomers(customerRows)
    setRows(paymentRows)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    const parsed = tryNairaToKobo(amount)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    const result = await window.api.recordPayment({
      customerId,
      amountKobo: parsed.kobo,
      method,
      notes
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setAmount('')
    setNotes('')
    await load()
  }

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-bold text-navy">Payments</h1>
      <p className="text-sm text-navy/70">Record a payment against a customer balance without creating a sale.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.2fr]">
        <form onSubmit={(event) => void save(event)} className="rounded-xl border border-navy/10 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">New payment</h2>
          <label className="mt-3 block text-sm">
            Customer
            <select value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))} className={inputClass}>
              <option value={0}>Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {formatOutstanding(customer.currentBalanceKobo)}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className="mt-2 text-xs text-navy/60">Current outstanding {formatOutstanding(selected.currentBalanceKobo)}</p>
          ) : null}
          <label className="mt-3 block text-sm">
            Amount (₦)
            <input value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} />
          </label>
          <label className="mt-3 block text-sm">
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
              {PAYMENT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Notes
            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
          </label>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Record payment
          </button>
        </form>

        <section>
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer or receipt #" className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void load()} className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white">
              Filter
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-navy/5">
                    <td className="px-4 py-2">{formatReceiptDate(row.paymentDate)}</td>
                    <td className="px-4 py-2">{row.customerName}</td>
                    <td className="px-4 py-2">{paymentMethodLabel(row.method)}</td>
                    <td className="px-4 py-2">
                      {row.receiptNumber ? `${row.receiptNumber}${row.voidedReceipt ? ' (voided)' : ''}` : 'Standalone'}
                    </td>
                    <td className="px-4 py-2 text-right">{formatNaira(row.amountKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
