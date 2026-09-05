import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNaira, formatOutstanding } from '@shared/money'
import type { DashboardData } from '@shared/types'
import headerIcon from '../assets/topline_icon_256.png'
import { useAuth } from '../context/AuthContext'

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api
      .getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) {
    return <p className="p-8 text-red-700">{error}</p>
  }
  if (!data) {
    return <p className="p-8 text-navy/70">Loading dashboard…</p>
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <img src={headerIcon} alt="Topline Stores" className="h-12 w-12 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
            <p className="mt-1 text-sm text-navy/70">
              Welcome back, {user?.fullName}. Next receipt {data.nextReceiptNumber}.
            </p>
          </div>
        </div>
        <Link
          to="/receipts/new"
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-mid"
        >
          New Receipt
        </Link>
      </div>

      {data.backupOverdue ? (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Database backup is due. An administrator can run a backup in Settings.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat title="Today's sales" value={formatNaira(data.todaySalesKobo)} note={`${data.todayReceiptCount} receipts`} />
        <Stat
          title="Outstanding"
          value={formatOutstanding(data.outstandingTotalKobo)}
          note={`${data.outstandingCount} customers owing`}
        />
        <Stat title="Printer" value={data.settings.printerWidth} note={data.branch.name} />
      </div>

      <section className="mt-6 rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Branch</h2>
        <p className="mt-2 font-medium text-navy">{data.branch.name}</p>
        <p className="text-sm text-navy/70">{data.branch.address}</p>
        <p className="text-sm text-navy/70">Tel: {data.branch.phone}</p>
        <p className="text-sm text-navy/70">Email: {data.branch.email}</p>
      </section>

      {data.highDebt.length > 0 ? (
        <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-sm font-bold uppercase text-red-800">High outstanding</h2>
          <ul className="mt-2 text-sm">
            {data.highDebt.map((row) => (
              <li key={row.id} className="flex justify-between py-1">
                <span>{row.name}</span>
                <span className="font-medium">{formatOutstanding(row.balanceKobo)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.lowStock.length > 0 ? (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold uppercase text-amber-900">Low stock</h2>
          <ul className="mt-2 text-sm">
            {data.lowStock.map((row) => (
              <li key={row.id} className="flex justify-between py-1">
                <span>{row.name}</span>
                <span>{row.stockQty}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Stat({ title, value, note }: { title: string; value: string; note: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-navy/50">{title}</p>
      <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-xs text-navy/50">{note}</p>
    </div>
  )
}
