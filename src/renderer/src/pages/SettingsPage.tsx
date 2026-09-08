import { FormEvent, useEffect, useState } from 'react'
import { formatReceiptNumber } from '@shared/format'
import { koboToNairaGrouped, tryNairaToKobo } from '@shared/money'
import type { AuditRow, BranchInfo, PrinterInfo, SettingsPayload, StaffUser, UserRole } from '@shared/types'
import settingsIcon from '../assets/topline_icon_512.png'
import { useAuth } from '../context/AuthContext'
import { PasswordInput } from '../components/PasswordInput'

const inputClass = 'mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold'

export function SettingsPage(): React.JSX.Element {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [payload, setPayload] = useState<SettingsPayload | null>(null)
  const [branch, setBranch] = useState<BranchInfo | null>(null)
  const [nextNumber, setNextNumber] = useState('1')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<Partial<StaffUser> & { password?: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  async function load(): Promise<void> {
    const [settingsPayload, printerRows, userRows, auditRows] = await Promise.all([
      window.api.getSettings(),
      window.api.listPrinters(),
      window.api.listUsers(),
      window.api.listAudit()
    ])
    setPayload(settingsPayload)
    setBranch(settingsPayload.branch)
    setNextNumber(String(settingsPayload.counter.nextNumber))
    setPrinters(printerRows)
    setUsers(userRows)
    setAudit(auditRows)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!payload || !branch) return
    const debt = tryNairaToKobo(
      koboToNairaGrouped(payload.settings.debtAlertKobo).replace(/,/g, '')
    )
    if (!debt.ok) {
      setError(debt.error)
      return
    }
    const result = await window.api.saveSettings({
      branch: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        receiptPrefix: branch.receiptPrefix
      },
      nextNumber: Number.parseInt(nextNumber, 10),
      settings: {
        ...payload.settings,
        debtAlertKobo: debt.kobo
      }
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setMessage('Settings saved.')
    await load()
  }

  async function backup(): Promise<void> {
    const result = await window.api.backupDatabase()
    setMessage(result.ok ? `Backup saved to ${result.data}` : result.error)
  }

  async function printTest(): Promise<void> {
    const result = await window.api.printTestPage()
    setMessage(result.ok ? 'Print dialog opened for the test page. This does not use a receipt number.' : result.error)
  }

  async function restore(): Promise<void> {
    const result = await window.api.restoreDatabase()
    setMessage(result.ok ? `Restored from ${result.data}. Sign in again if needed.` : result.error)
    await load()
  }

  async function resetApp(): Promise<void> {
    if (!isAdmin) {
      setResetError('Only an administrator can reset and delete shop data.')
      return
    }
    if (resetConfirm.trim().toUpperCase() !== 'DELETE') {
      setResetError('Type DELETE to confirm you want to erase all shop data.')
      return
    }
    if (!resetPassword) {
      setResetError('Enter your admin password to reset.')
      return
    }
    setResetting(true)
    setResetError(null)
    try {
      const result = await window.api.factoryResetApp(resetPassword, resetConfirm)
      if (!result.ok) {
        setResetError(result.error)
        setResetting(false)
      }
    } catch {
      setResetError('Could not reset. Sign in as admin and try again.')
      setResetting(false)
    }
  }

  async function saveUser(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!userForm) return
    const result = await window.api.saveUser({
      id: userForm.id,
      username: userForm.username ?? '',
      fullName: userForm.fullName ?? '',
      role: (userForm.role ?? 'cashier') as UserRole,
      password: userForm.password,
      active: userForm.active !== false,
      mustChangePassword: Boolean(userForm.mustChangePassword)
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUserForm(null)
    await load()
  }

  if (!payload || !branch) {
    return <p className="p-8 text-navy/70">Loading settings…</p>
  }

  const previewNumber = formatReceiptNumber(branch.receiptPrefix, Number.parseInt(nextNumber, 10) || 1)

  return (
    <div className="px-8 py-8">
      <div className="flex items-start gap-4">
        <img src={settingsIcon} alt="Topline Stores" className="h-20 w-20 rounded-full" />
        <div>
          <h1 className="text-2xl font-bold text-navy">Settings</h1>
          <p className="text-sm text-navy/70">Administrator only. Database file: {payload.dbPath}</p>
        </div>
      </div>
      {message ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={(event) => void save(event)} className="mt-6 space-y-6">
        <section className="rounded-xl border border-navy/10 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Business info</h2>
          <label className="mt-3 block text-sm">
            Name
            <input value={branch.name} onChange={(event) => setBranch({ ...branch, name: event.target.value })} className={inputClass} />
          </label>
          <label className="mt-3 block text-sm">
            Address
            <input value={branch.address} onChange={(event) => setBranch({ ...branch, address: event.target.value })} className={inputClass} />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Phone
              <input value={branch.phone} onChange={(event) => setBranch({ ...branch, phone: event.target.value })} className={inputClass} />
            </label>
            <label className="text-sm">
              Email
              <input value={branch.email} onChange={(event) => setBranch({ ...branch, email: event.target.value })} className={inputClass} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">Receipt numbering</h2>
          <p className="mt-2 text-sm text-amber-950">
            Digital receipts continue the paper book after #SA0000006781. Next will print as{' '}
            <span className="font-semibold">{previewNumber}</span>.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm">
              Prefix
              <input
                value={branch.receiptPrefix}
                onChange={(event) => setBranch({ ...branch, receiptPrefix: event.target.value.toUpperCase() })}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Next number
              <input value={nextNumber} onChange={(event) => setNextNumber(event.target.value)} className={inputClass} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-navy/10 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Printer &amp; options</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Width
              <select
                value={payload.settings.printerWidth}
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    settings: { ...payload.settings, printerWidth: event.target.value as '58mm' | '80mm' }
                  })
                }
                className={inputClass}
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </label>
            <label className="text-sm">
              Printer
              <select
                value={payload.settings.printerName}
                onChange={(event) =>
                  setPayload({ ...payload, settings: { ...payload.settings, printerName: event.target.value } })
                }
                className={inputClass}
              >
                <option value="">Ask each time (print dialog)</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName}
                    {printer.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void printTest()}
            className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-dark"
          >
            Print test page
          </button>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.settings.taxEnabled}
              onChange={(event) =>
                setPayload({ ...payload, settings: { ...payload.settings, taxEnabled: event.target.checked } })
              }
            />
            Enable tax/VAT
          </label>
          {payload.settings.taxEnabled ? (
            <label className="mt-2 block text-sm">
              Tax percent
              <input
                value={payload.settings.taxPercent}
                onChange={(event) =>
                  setPayload({ ...payload, settings: { ...payload.settings, taxPercent: event.target.value } })
                }
                className={inputClass}
              />
            </label>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.settings.discountEnabled}
              onChange={(event) =>
                setPayload({ ...payload, settings: { ...payload.settings, discountEnabled: event.target.checked } })
              }
            />
            Enable discount line
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.settings.stockTrackingEnabled}
              onChange={(event) =>
                setPayload({ ...payload, settings: { ...payload.settings, stockTrackingEnabled: event.target.checked } })
              }
            />
            Enable live stock tracking
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.settings.openAtLogin}
              onChange={(event) =>
                setPayload({ ...payload, settings: { ...payload.settings, openAtLogin: event.target.checked } })
              }
            />
            Open Topline when Windows starts
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm">
              Idle logout (minutes)
              <input
                value={String(payload.settings.idleLogoutMinutes)}
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    settings: { ...payload.settings, idleLogoutMinutes: Number(event.target.value) || 0 }
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Backup reminder (days)
              <input
                value={String(payload.settings.backupReminderDays)}
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    settings: { ...payload.settings, backupReminderDays: Number(event.target.value) || 0 }
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              High-debt alert (₦)
              <input
                defaultValue={koboToNairaGrouped(payload.settings.debtAlertKobo).replace(/,/g, '')}
                onBlur={(event) => {
                  const parsed = tryNairaToKobo(event.target.value)
                  if (parsed.ok) {
                    setPayload({ ...payload, settings: { ...payload.settings, debtAlertKobo: parsed.kobo } })
                  }
                }}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
          Save settings
        </button>
      </form>

      <section className="mt-8 rounded-xl border border-navy/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Users</h2>
          <button
            type="button"
            onClick={() =>
              setUserForm({
                username: '',
                fullName: '',
                role: 'cashier',
                active: true,
                mustChangePassword: true,
                password: ''
              })
            }
            className="text-sm font-semibold text-navy-mid"
          >
            + Add user
          </button>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="py-1">Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((staff) => (
              <tr key={staff.id} className="border-t border-navy/5">
                <td className="py-1">{staff.username}</td>
                <td>{staff.fullName}</td>
                <td className="capitalize">{staff.role}</td>
                <td>{staff.active ? 'Active' : 'Inactive'}</td>
                <td className="text-right">
                  <button type="button" onClick={() => setUserForm({ ...staff, password: '' })} className="text-navy-mid">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-xl border border-navy/10 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Backup &amp; restore</h2>
        <p className="mt-2 text-sm text-navy/70">
          Backup now copies the database to the <span className="font-semibold">Topline Backups</span> folder on the
          Desktop. Restore replaces the current file after confirmation.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void backup()} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
            Backup now
          </button>
          {isAdmin ? (
            <button type="button" onClick={() => void restore()} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">
              Restore…
            </button>
          ) : null}
        </div>
      </section>

      {isAdmin ? (
      <section className="mt-6 rounded-xl border border-navy/10 bg-white p-5">
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((open) => !open)
            setResetError(null)
            setResetPassword('')
            setResetConfirm('')
          }}
          className="text-sm font-semibold text-navy/50 hover:text-navy"
        >
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>
        {showAdvanced ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-800">Reset and delete all data (admin only)</h2>
            <p className="mt-2 text-sm text-red-950">
              Erases receipts, customers, payments, products and users, then starts the shop as new.
              A backup is saved to the Desktop <span className="font-semibold">Topline Backups</span> folder
              first. After reset, sign in as <span className="font-semibold">admin</span> /{' '}
              <span className="font-semibold">changeme</span>.
            </p>
            <p className="mt-2 text-sm text-navy/70">
              To remove the program from this PC, use Windows Settings → Apps. That uninstall does not
              delete the shop database unless you reset here first.
            </p>
            <label className="mt-3 block text-sm">
              Type DELETE to confirm
              <input
                value={resetConfirm}
                onChange={(event) => {
                  setResetConfirm(event.target.value)
                  setResetError(null)
                }}
                className={inputClass}
              />
            </label>
            <label className="mt-3 block text-sm">
              Your password
              <PasswordInput
                className="text-sm"
                autoComplete="current-password"
                value={resetPassword}
                onChange={(value) => {
                  setResetPassword(value)
                  setResetError(null)
                }}
              />
            </label>
            {resetError ? <p className="mt-2 text-sm text-red-700">{resetError}</p> : null}
            <button
              type="button"
              disabled={resetting || !resetPassword || resetConfirm.trim().toUpperCase() !== 'DELETE'}
              onClick={() => void resetApp()}
              className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {resetting ? 'Deleting…' : 'Reset and delete all data'}
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-navy/10 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Audit log</h2>
        <div className="mt-3 max-h-64 overflow-y-auto text-xs">
          {audit.map((row) => (
            <div key={row.id} className="border-b border-navy/5 py-1">
              <span className="text-navy/50">{row.timestamp}</span> · {row.username ?? 'system'} · {row.action} {row.entity}{' '}
              {row.entity_id ?? ''}
            </div>
          ))}
        </div>
      </section>

      {userForm ? (
        <form onSubmit={(event) => void saveUser(event)} className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-bold text-navy">{userForm.id ? 'Edit user' : 'Add user'}</h3>
            <label className="mt-3 block text-sm">
              Username
              <input value={userForm.username ?? ''} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Full name
              <input value={userForm.fullName ?? ''} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm">
              Role
              <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as UserRole })} className={inputClass}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              Password {userForm.id ? '(leave blank to keep)' : ''}
              <PasswordInput
                className="text-sm"
                value={userForm.password ?? ''}
                onChange={(value) => setUserForm({ ...userForm, password: value })}
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={userForm.active !== false} onChange={(event) => setUserForm({ ...userForm, active: event.target.checked })} />
              Active
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(userForm.mustChangePassword)}
                onChange={(event) => setUserForm({ ...userForm, mustChangePassword: event.target.checked })}
              />
              Must change password on next login
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setUserForm(null)} className="px-3 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
                Save user
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <p className="mt-8 text-center text-xs text-navy/40">Developed by DataQay</p>
    </div>
  )
}
