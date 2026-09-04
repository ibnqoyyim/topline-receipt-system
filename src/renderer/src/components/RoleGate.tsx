import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { canAccessScreen } from '../../../shared/permissions'
import type { ScreenKey } from '../../../shared/types'
import { useAuth } from '../context/AuthContext'

export function RoleGate({
  screen,
  children
}: {
  screen: ScreenKey
  children: ReactNode
}): React.JSX.Element {
  const { user } = useAuth()
  if (!user || !canAccessScreen(user.role, screen)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
