import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canEditCustomers } from '@shared/permissions'
import { formatReceiptDate, paymentMethodLabel } from '@shared/format'
import { formatNaira, formatOutstanding, tryNairaToKobo } from '@shared/money'
import type { CustomerRecord, PaymentRecord, ReceiptSummary } from '@shared/types'
import { useAuth } from '../context/AuthContext'

const inputClass = 'mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold'

export function CustomersPage(): React.JSX.Element {
  const { user } = useAuth()
  const canEdit = user ? canEditCustomers(user.role) : false
  const [rows, setRows] = useState<CustomerRecord[]>([])
  const [query, setQuery] = useState('')
  const [balance, setBalance] = useState<'all' | 'owing' | 'settled'>('all')
  const [editing, setEditing] = useState<Partial<CustomerRecord> & { opening?: string } | null>(null)
  const [historyId, setHistoryId] = useState<number | null>(null)
  const [history, setHistory] = useState<{
    customer: CustomerRecord
    receipts: ReceiptSummary[]
    payments: PaymentRecord[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setRows(await window.api.listCustomers({ query, balance }))
  }

  useEffect(() => {
    void load()
  }, [balance])

  useEffect(() => {
    if (!historyId) {
      setHistory(null)
      return
    }
    void window.api.getCustomerHistory(historyId).then((result) => {
      if (result.ok) setHistory(result.data)
    })
  }, [historyId])

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!editing) return
    const opening = editing.id ? undefined : tryNairaToKobo(editing.opening ?? '0')
    if (opening && !opening.ok) {
      setError(opening.error)
      return
    }
    const result = await window.api.saveCustomer({
      id: editing.id,
      name: editing.name ?? '',
      phone: editing.phone ?? '',
      address: editing.address ?? '',
      notes: editing.notes ?? '',
      openingBalanceKobo: opening?.ok ? opening.kobo : 0
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(null)
    setError(null)
    await load()
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Customers</h1>
          <p className="text-sm text-navy/70">Running balances are maintained by receipts and payments.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ name: '', phone: '', address: '', notes: '', opening: '0' })}
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Add customer
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or phone" className="rounded-md border border-navy/20 px-3 py-2 text-sm" />
        <select value={balance} onChange={(event) => setBalance(event.target.value as typeof balance)} className="rounded-md border border-navy/20 px-3 py-2 text-sm">
          <option value="all">All balances</option>
          <option value="owing">Owing</option>
          <option value="settled">Settled</option>
        </select>
        <button type="button" onClick={() => void load()} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-navy/5">
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2">{row.phone}</td>
                <td className="px-4 py-2 text-right">{formatOutstanding(row.currentBalanceKobo)}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => setHistoryId(row.id)} className="text-navy-mid">
                    History
                  </button>
                  {canEdit ? (
                    <button type="button" onClick={() => setEditing(row)} className="ml-3 text-navy-mid">
                      Edit
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history ? (
        <div className="mt-6 rounded-xl border border-navy/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy">
              {history.customer.name} · {formatOutstanding(history.customer.currentBalanceKobo)}
            </h2>
            <button type="button" onClick={() => setHistoryId(null)} className="text-sm">
              Close
            </button>
          </div>
          <h3 className="mt-4 text-xs font-bold uppercase text-navy/50">Receipts</h3>
          <ul className="mt-2 text-sm">
            {history.receipts.map((receipt) => (
              <li key={receipt.id} className="flex justify-between border-b border-navy/5 py-1">
                <Link to={`/receipts/preview/${receipt.id}`} className="text-navy-mid">
                  {receipt.receiptNumber} · {formatReceiptDate(receipt.receiptDate)}
                </Link>
                <span>
                  {formatNaira(receipt.totalKobo)} {receipt.status === 'voided' ? '(VOID)' : ''}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-xs font-bold uppercase text-navy/50">Payments</h3>
          <ul className="mt-2 text-sm">
            {history.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between border-b border-navy/5 py-1">
                <span>
                  {formatReceiptDate(payment.paymentDate)} · {paymentMethodLabel(payment.method)}
                  {payment.voidedReceipt ? ' (voided receipt)' : ''}
                </span>
                <span>{formatNaira(payment.amountKobo)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={(event) => void save(event)} className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h2 className="text-lg font-bold text-navy">{editing.id ? 'Edit customer' : 'Add customer'}</h2>
            <label className="mt-3 block text-sm">
              Name
              <input value={editing.name ?? ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Phone
              <input value={editing.phone ?? ''} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Address
              <input value={editing.address ?? ''} onChange={(event) => setEditing({ ...editing, address: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Notes
              <input value={editing.notes ?? ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} className={inputClass} />
            </label>
            {!editing.id ? (
              <label className="mt-3 block text-sm">
                Opening balance (₦ owed)
                <input value={editing.opening ?? '0'} onChange={(event) => setEditing({ ...editing, opening: event.target.value })} className={inputClass} />
              </label>
            ) : (
              <p className="mt-3 text-xs text-navy/50">
                Current balance {formatOutstanding(editing.currentBalanceKobo ?? 0)} is maintained by the system and cannot be edited here.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
                Save
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  )
}
