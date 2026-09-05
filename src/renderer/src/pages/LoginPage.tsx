import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/topline_icon_256.png'

export function LoginPage(): React.JSX.Element {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : '/dashboard'} replace />
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const message = await login(username, password)
    if (message) setError(message)
    setBusy(false)
  }

  return (
    <div className="flex h-full bg-navy">
      <div className="hidden w-[46%] flex-col justify-between border-r border-gold/30 p-10 lg:flex">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Topline Stores" className="h-16 w-16 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-white">TOPLINE STORES</h1>
            <p className="text-sm text-gold">Division of Topline Realtor &amp; Investment Ltd</p>
          </div>
        </div>
        <div className="text-white/80">
          <p className="text-lg font-semibold text-white">Receipt System</p>
          <p className="mt-2 max-w-sm text-sm leading-6">
            Offline point-of-sale for the Sawmill Area branch. All sales, credit balances, and
            receipts stay on this computer.
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40">Fully offline · Local SQLite database</p>
          <p className="mt-2 text-xs text-white/35">Developed by DataQay</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <form
          onSubmit={(event) => void onSubmit(event)}
          autoComplete="off"
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        >
          <h2 className="text-xl font-bold text-navy">Sign in</h2>
          <p className="mt-1 text-sm text-navy/70">Use your Topline staff account.</p>

          <label className="mt-6 block text-sm font-medium text-navy">
            Username
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 outline-none focus:border-gold"
              autoComplete="off"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-navy">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-navy/20 px-3 py-2 outline-none focus:border-gold"
              autoComplete="off"
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
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-xs text-navy/50">
            First login: username <span className="font-semibold">admin</span>, password{' '}
            <span className="font-semibold">changeme</span>
          </p>
          <p className="mt-3 text-center text-xs text-navy/40">Developed by DataQay</p>
        </form>
      </div>
    </div>
  )
}
