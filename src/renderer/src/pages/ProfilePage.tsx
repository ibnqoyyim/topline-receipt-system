import { FormEvent, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function ProfilePage(): React.JSX.Element {
  const { user, markPasswordChanged } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await window.api.changePassword(currentPassword, newPassword)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    markPasswordChanged()
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setNotice('Password changed.')
  }

  return (
    <div className="mx-auto max-w-lg px-8 py-8">
      <h1 className="text-2xl font-bold text-navy">My profile</h1>
      <p className="mt-1 text-sm text-navy/70">
        {user?.fullName} · {user?.username} · {user?.role}
      </p>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 rounded-xl border border-navy/10 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gold-dark">Change password</h2>
        <label className="mt-4 block text-sm">
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="mt-3 block text-sm">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="mt-3 block text-sm">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
