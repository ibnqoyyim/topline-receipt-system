import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { canAdjustReceipt, canVoidReceipt } from '@shared/permissions'
import type { AppSettings, ReceiptDetail } from '@shared/types'
import { ReceiptTicket } from '../components/ReceiptTicket'
import { useAuth } from '../context/AuthContext'

export function ReceiptPreviewPage(): React.JSX.Element {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const autoPrinted = useRef(false)

  useEffect(() => {
    void window.api.getAppContext().then((context) => setSettings(context.settings))
  }, [])

  useEffect(() => {
    if (!id) {
      setReceipt(null)
      return
    }
    void window.api.getReceipt(Number(id)).then((result) => {
      if (!result.ok) {
        setError(result.error)
        setReceipt(null)
        return
      }
      setError(null)
      setReceipt(result.data)
    })
  }, [id])

  async function printReceipt(): Promise<void> {
    if (!receipt) return
    setBusy(true)
    setNotice('Opening print dialog…')
    const result = await window.api.printReceipt(receipt.id)
    setBusy(false)
    setNotice(result.ok ? 'Print sent. If nothing printed, choose a printer in Settings and try again.' : result.error)
  }

  useEffect(() => {
    if (!receipt || searchParams.get('print') !== '1' || autoPrinted.current) return
    autoPrinted.current = true
    setSearchParams({}, { replace: true })
    void printReceipt()
  }, [receipt, searchParams, setSearchParams])

  async function pdf(): Promise<void> {
    if (!receipt) return
    setBusy(true)
    const result = await window.api.exportReceiptPdf(receipt.id)
    setBusy(false)
    setNotice(result.ok ? `Saved PDF: ${result.data}` : result.error)
  }

  async function voidCurrent(): Promise<void> {
    if (!receipt) return
    if (!window.confirm(`Void ${receipt.receiptNumber}? The number will not be reused.`)) return
    setBusy(true)
    const result = await window.api.voidReceipt(receipt.id)
    setBusy(false)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    setReceipt(result.data)
    setNotice('Receipt voided.')
  }

  if (!id) {
    return (
      <div className="px-8 py-8">
        <h1 className="text-2xl font-bold text-navy">Receipt Preview</h1>
        <p className="mt-2 text-sm text-navy/70">
          Save a receipt or open one from{' '}
          <Link to="/receipts" className="font-semibold text-navy-mid">
            Receipt History
          </Link>{' '}
          to preview and print.
        </p>
      </div>
    )
  }

  if (error) {
    return <p className="p-8 text-red-700">{error}</p>
  }

  if (!receipt || !settings) {
    return <p className="p-8 text-navy/70">Loading receipt…</p>
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Receipt Preview</h1>
          <p className="text-sm text-navy/70">
            {receipt.receiptNumber} · {settings.printerWidth} thermal layout
            {receipt.adjusted ? ' · Adjusted' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void printReceipt()}
            className="rounded-md bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-gold-dark disabled:opacity-60"
          >
            {busy ? 'Printing…' : 'Print Receipt'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pdf()}
            className="rounded-md border border-navy/20 px-4 py-2 text-sm font-semibold text-navy"
          >
            Export PDF
          </button>
          {user && canAdjustReceipt(user.role) && receipt.status === 'active' ? (
            <Link
              to={`/receipts/adjust/${receipt.id}`}
              className="rounded-md border border-navy/20 px-4 py-2 text-sm font-semibold text-navy"
            >
              Adjust
            </Link>
          ) : null}
          {user && canVoidReceipt(user.role) && receipt.status === 'active' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void voidCurrent()}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
            >
              Void
            </button>
          ) : null}
        </div>
      </div>
      {notice ? <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}
      {receipt.adjustments.length > 0 ? (
        <div className="mb-4 rounded-md border border-navy/10 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-navy">Adjustment history</p>
          <ul className="mt-2 space-y-1 text-navy/80">
            {receipt.adjustments.map((row) => (
              <li key={row.id}>
                {row.createdAt} · {row.username}: {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl bg-[#d8d2c8] p-8">
        <ReceiptTicket receipt={receipt} width={settings.printerWidth} />
      </div>
    </div>
  )
}
