import { FormEvent, useEffect, useState } from 'react'
import { canDeleteProducts } from '@shared/permissions'
import { formatNaira, koboToNairaGrouped, tryNairaToKobo } from '@shared/money'
import type { ProductRecord } from '@shared/types'
import { useAuth } from '../context/AuthContext'

const inputClass = 'mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold'
const UNITS = ['packet', 'carton', 'piece', 'litre', 'crate', 'bottle']

export function ProductsPage(): React.JSX.Element {
  const { user } = useAuth()
  const [rows, setRows] = useState<ProductRecord[]>([])
  const [editing, setEditing] = useState<Partial<ProductRecord> & { unitPrice?: string; stock?: string } | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setRows(await window.api.listProducts(includeInactive))
  }

  useEffect(() => {
    void load()
  }, [includeInactive])

  function startNew(): void {
    setEditing({
      name: '',
      category: '',
      unit: 'packet',
      unitPrice: '0',
      trackStock: false,
      stock: '',
      active: true
    })
  }

  function startEdit(product: ProductRecord): void {
    setEditing({
      ...product,
      unitPrice: koboToNairaGrouped(product.unitPriceKobo).replace(/,/g, ''),
      stock: product.stockQty == null ? '' : String(product.stockQty)
    })
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!editing) return
    const price = tryNairaToKobo(editing.unitPrice ?? '0')
    if (!price.ok) {
      setError(price.error)
      return
    }
    const stockRaw = editing.stock?.trim() ?? ''
    const result = await window.api.saveProduct({
      id: editing.id,
      name: editing.name ?? '',
      category: editing.category ?? '',
      unit: editing.unit ?? 'packet',
      unitPriceKobo: price.kobo,
      trackStock: Boolean(editing.trackStock),
      stockQty: stockRaw === '' ? null : Number.parseInt(stockRaw, 10),
      active: editing.active !== false
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setEditing(null)
    await load()
  }

  async function deactivate(id: number): Promise<void> {
    if (!window.confirm('Deactivate this product? Historical receipts keep the old price.')) return
    const result = await window.api.deactivateProduct(id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Products</h1>
          <p className="text-sm text-navy/70">Prices on new receipts are snapshots; old receipts do not change.</p>
        </div>
        <button type="button" onClick={startNew} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
          Add product
        </button>
      </div>

      <label className="mt-4 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
        Show inactive
      </label>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-navy/5">
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2">{row.category}</td>
                <td className="px-4 py-2">{row.unit}</td>
                <td className="px-4 py-2 text-right">{formatNaira(row.unitPriceKobo)}</td>
                <td className="px-4 py-2">{row.trackStock ? (row.stockQty ?? '—') : 'Off'}</td>
                <td className="px-4 py-2">{row.active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => startEdit(row)} className="text-navy-mid">
                    Edit
                  </button>
                  {user && canDeleteProducts(user.role) && row.active ? (
                    <button type="button" onClick={() => void deactivate(row.id)} className="ml-3 text-red-700">
                      Deactivate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <form onSubmit={(event) => void save(event)} className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h2 className="text-lg font-bold text-navy">{editing.id ? 'Edit product' : 'Add product'}</h2>
            <label className="mt-3 block text-sm">
              Name
              <input value={editing.name ?? ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Category
              <input value={editing.category ?? ''} onChange={(event) => setEditing({ ...editing, category: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Unit
              <select value={editing.unit} onChange={(event) => setEditing({ ...editing, unit: event.target.value })} className={inputClass}>
                {UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              Unit price (₦)
              <input value={editing.unitPrice ?? ''} onChange={(event) => setEditing({ ...editing, unitPrice: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(editing.trackStock)}
                onChange={(event) => setEditing({ ...editing, trackStock: event.target.checked })}
              />
              Track stock
            </label>
            {editing.trackStock ? (
              <label className="mt-3 block text-sm">
                Stock quantity
                <input value={editing.stock ?? ''} onChange={(event) => setEditing({ ...editing, stock: event.target.value })} className={inputClass} />
              </label>
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active !== false}
                onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
              />
              Active
            </label>
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
