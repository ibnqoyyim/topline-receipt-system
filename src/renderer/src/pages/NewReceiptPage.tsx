import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAYMENT_METHODS } from '@shared/format'
import { formatNaira, formatOutstanding, koboToNairaGrouped, percentOfKobo, tryNairaToKobo } from '@shared/money'
import type { AppSettings, CustomerRecord, PaymentMethod, ProductRecord } from '@shared/types'

interface DraftLine {
  key: string
  productId: number | null
  description: string
  qty: string
  unitPrice: string
}

const inputClass =
  'mt-1 w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold'

export function NewReceiptPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customerId, setCustomerId] = useState<number | 0>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  useEffect(() => {
    void Promise.all([
      window.api.listProducts(false),
      window.api.listCustomers(),
      window.api.getAppContext()
    ]).then(([productRows, customerRows, context]) => {
      setProducts(productRows)
      setCustomers(customerRows)
      setSettings(context.settings)
    })
  }, [])

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const qty = Number.parseInt(line.qty, 10)
      const price = tryNairaToKobo(line.unitPrice)
      const unitPriceKobo = price.ok ? price.kobo : 0
      const lineTotal = Number.isInteger(qty) && qty > 0 ? qty * unitPriceKobo : 0
      return { ...line, qty: Number.isInteger(qty) ? qty : 0, unitPriceKobo, lineTotal }
    })
  }, [lines])

  const subtotal = computedLines.reduce((sum, line) => sum + line.lineTotal, 0)
  const tax = settings?.taxEnabled ? percentOfKobo(subtotal, settings.taxPercent) : 0
  const discountParsed = tryNairaToKobo(discount)
  const discountKobo = settings?.discountEnabled && discountParsed.ok ? Math.max(0, discountParsed.kobo) : 0
  const total = subtotal + tax - discountKobo
  const paidParsed = tryNairaToKobo(amountPaid)
  const amountPaidKobo = paidParsed.ok ? paidParsed.kobo : 0
  const selectedCustomer = customers.find((customer) => customer.id === customerId)
  const balanceBefore = selectedCustomer?.currentBalanceKobo ?? 0
  const newDebt = total - amountPaidKobo
  const balanceAfter = balanceBefore + newDebt

  const suggestions = products
    .filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase()))
    .slice(0, 8)

  function addProduct(product: ProductRecord): void {
    const description = `${product.name} (${product.unit})`.toUpperCase()
    setLines((current) => [
      ...current,
      {
        key: `${Date.now()}-${product.id}`,
        productId: product.id,
        description,
        qty: '1',
        unitPrice: koboToNairaGrouped(product.unitPriceKobo).replace(/,/g, '')
      }
    ])
    setProductQuery('')
  }

  function addFreeText(): void {
    if (!productQuery.trim()) return
    setLines((current) => [
      ...current,
      {
        key: `${Date.now()}-free`,
        productId: null,
        description: productQuery.trim().toUpperCase(),
        qty: '1',
        unitPrice: '0'
      }
    ])
    setProductQuery('')
  }

  function updateLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  async function onSave(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    const items = computedLines
      .filter((line) => line.description.trim())
      .map((line) => ({
        productId: line.productId,
        description: line.description,
        qty: line.qty,
        unitPriceKobo: line.unitPriceKobo
      }))
    if (items.length === 0) {
      setError('Add at least one line item.')
      return
    }
    if (!paidParsed.ok) {
      setError(paidParsed.error)
      return
    }
    setBusy(true)
    const result = await window.api.saveReceipt({
      customerId: customerId === 0 ? null : customerId,
      paymentMethod,
      amountPaidKobo,
      discountKobo,
      notes,
      items
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(`/receipts/preview/${result.data.id}`)
  }

  function fillPaidTotal(): void {
    setAmountPaid(koboToNairaGrouped(total).replace(/,/g, ''))
  }

  return (
    <form onSubmit={(event) => void onSave(event)} className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">New Receipt</h1>
          <p className="text-sm text-navy/70">Add lines, choose a customer, take payment, then save.</p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-mid disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save receipt'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-navy">
            Add item
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (suggestions[0]) addProduct(suggestions[0])
                  else addFreeText()
                }
              }}
              placeholder="Search products or type a free-text charge (e.g. OPAY CHARGES)"
              className={inputClass}
            />
          </label>
          {productQuery.trim() ? (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-navy/10">
              {suggestions.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-navy/5"
                >
                  <span>
                    {product.name} <span className="text-navy/50">({product.unit})</span>
                  </span>
                  <span className="font-medium">{formatNaira(product.unitPriceKobo)}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={addFreeText}
                className="w-full border-t border-navy/10 px-3 py-2 text-left text-sm text-navy-mid hover:bg-navy/5"
              >
                Add free-text item “{productQuery.trim().toUpperCase()}”
              </button>
            </div>
          ) : null}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="pb-2">Qty</th>
                <th className="pb-2">Details</th>
                <th className="pb-2">Unit price</th>
                <th className="pb-2 text-right">Extend</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {computedLines.map((line) => (
                <tr key={line.key} className="border-b border-navy/5">
                  <td className="py-2 pr-2 w-20">
                    <input
                      value={lines.find((item) => item.key === line.key)?.qty ?? ''}
                      onChange={(event) => updateLine(line.key, { qty: event.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={line.description}
                      onChange={(event) => updateLine(line.key, { description: event.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2 w-32">
                    <input
                      value={lines.find((item) => item.key === line.key)?.unitPrice ?? ''}
                      onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 text-right font-medium">{koboToNairaGrouped(line.lineTotal)}</td>
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                      className="text-xs text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-navy/50">
                    No lines yet. Search a product or add a free-text charge.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Customer</h2>
              <button
                type="button"
                onClick={() => setShowCustomerForm(true)}
                className="text-xs font-semibold text-navy-mid"
              >
                + Add
              </button>
            </div>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(Number(event.target.value))}
              className={inputClass}
            >
              <option value={0}>Walk-in / Cash customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.currentBalanceKobo > 0
                    ? ` · owes ${formatOutstanding(customer.currentBalanceKobo)}`
                    : ''}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Payment</h2>
            <label className="mt-3 block text-sm">
              Method
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className={inputClass}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            {settings?.discountEnabled ? (
              <label className="mt-3 block text-sm">
                Discount (₦)
                <input value={discount} onChange={(event) => setDiscount(event.target.value)} className={inputClass} />
              </label>
            ) : null}
            <label className="mt-3 block text-sm">
              Amount paid (₦)
              <input value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} className={inputClass} />
            </label>
            <button type="button" onClick={fillPaidTotal} className="mt-2 text-xs font-semibold text-navy-mid">
              Fill with total {formatNaira(total)}
            </button>
            <label className="mt-3 block text-sm">
              Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
            </label>
          </section>

          <section className="rounded-xl border border-navy/10 bg-white p-5 text-sm shadow-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatNaira(subtotal)}</span>
            </div>
            {settings?.taxEnabled ? (
              <div className="mt-1 flex justify-between">
                <span>Tax ({settings.taxPercent}%)</span>
                <span>{formatNaira(tax)}</span>
              </div>
            ) : null}
            {discountKobo ? (
              <div className="mt-1 flex justify-between">
                <span>Discount</span>
                <span>-{formatNaira(discountKobo)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatNaira(total)}</span>
            </div>
            <div className="mt-3 border-t border-navy/10 pt-3">
              <div className="flex justify-between text-navy/70">
                <span>Balance before</span>
                <span>{formatOutstanding(balanceBefore)}</span>
              </div>
              <div className="mt-1 flex justify-between font-bold">
                <span>Outstanding after</span>
                <span>{formatOutstanding(balanceAfter)}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {showCustomerForm ? (
        <QuickCustomerModal
          onClose={() => setShowCustomerForm(false)}
          onSaved={(customer) => {
            setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name)))
            setCustomerId(customer.id)
            setShowCustomerForm(false)
          }}
        />
      ) : null}
    </form>
  )
}

function QuickCustomerModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: (customer: CustomerRecord) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    setBusy(true)
    const result = await window.api.saveCustomer({ name, phone, address: '', notes: '', openingBalanceKobo: 0 })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved(result.data)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-navy">Add customer</h3>
        <label className="mt-4 block text-sm">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 block text-sm">
          Phone
          <input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
        </label>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
