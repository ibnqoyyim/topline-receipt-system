import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Sidebar } from './Sidebar'

export function RequireAuth(): React.JSX.Element {
  const { ready, user } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-navy text-white">
        Loading Topline Receipt System…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export function AppShell(): React.JSX.Element {
  const { user, logout } = useAuth()
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let minutes = 15
    void window.api.getAppContext().then((context) => {
      minutes = context.settings.idleLogoutMinutes || 0
    })

    function reset(): void {
      if (timer.current) window.clearTimeout(timer.current)
      if (!minutes) return
      timer.current = window.setTimeout(() => {
        void logout()
      }, minutes * 60_000)
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click']
    events.forEach((event) => window.addEventListener(event, reset))
    reset()
    return () => {
      events.forEach((event) => window.removeEventListener(event, reset))
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [logout])

  function refreshApp(): void {
    window.location.reload()
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-full">
      <Sidebar
        role={user.role}
        username={user.username}
        fullName={user.fullName}
        onLogout={() => void logout()}
        onRefresh={refreshApp}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-[#f4f1ea]">
        <header className="flex shrink-0 items-center justify-between border-b border-navy/10 bg-white px-6 py-3">
          <p className="text-sm font-medium text-navy">Topline Receipt System</p>
          <button
            type="button"
            onClick={refreshApp}
            className="rounded-md border border-navy/20 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy/5"
          >
            Refresh
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
