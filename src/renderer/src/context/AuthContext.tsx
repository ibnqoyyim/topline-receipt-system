import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { BranchInfo, SessionUser } from '../../../shared/types'

interface AuthState {
  ready: boolean
  user: SessionUser | null
  branch: BranchInfo | null
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  markPasswordChanged: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [branch, setBranch] = useState<BranchInfo | null>(null)

  const refreshSession = useCallback(async () => {
    const session = await window.api.getSession()
    setUser(session)
    if (session) {
      const context = await window.api.getAppContext()
      setBranch(context.branch)
    } else {
      setBranch(null)
    }
  }, [])

  useEffect(() => {
    void refreshSession().finally(() => setReady(true))
  }, [refreshSession])

  const login = useCallback(async (username: string, password: string) => {
    const result = await window.api.login(username, password)
    if (!result.ok) return result.error
    setUser(result.user)
    setBranch(result.branch)
    return null
  }, [])

  const logout = useCallback(async () => {
    await window.api.logout()
    setUser(null)
    setBranch(null)
  }, [])

  const markPasswordChanged = useCallback(() => {
    setUser((current) => (current ? { ...current, mustChangePassword: false } : current))
  }, [])

  const value = useMemo(
    () => ({
      ready,
      user,
      branch,
      login,
      logout,
      refreshSession,
      markPasswordChanged
    }),
    [ready, user, branch, login, logout, refreshSession, markPasswordChanged]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
