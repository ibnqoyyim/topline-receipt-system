import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export function ChangePasswordPage(): React.JSX.Element {
  const { markPasswordChanged } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await window.api.changePassword(currentPassword, newPassword)
    if (!result.ok) {
      setError(result.error)
      setBusy(false)
      return
    }
    markPasswordChanged()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex h-full items-center justify-center bg-navy p-6">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="Topline Stores" className="h-12 w-12 rounded-full" />
          <div>
            <h1 className="text-lg font-bold text-navy">Change password</h1>
            <p className="text-sm text-navy/70">Required on first login for the admin account.</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-navy">
          Current password
          <input
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 outline-none focus:border-gold"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-navy">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 outline-none focus:border-gold"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-navy">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 outline-none focus:border-gold"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white hover:bg-navy-mid disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save password and continue'}
        </button>
      </form>
    </div>
  )
}
