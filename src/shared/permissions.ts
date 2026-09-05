import type { ScreenKey, UserRole } from './types'

/**
 * Derived from SRS Section 4 (User Roles & Permissions).
 * Login is assumed for every role. Cashier Reports is allowed (own-shift only later).
 */
export function canAccessScreen(role: UserRole, screen: ScreenKey): boolean {
  switch (screen) {
    case 'products':
      return role === 'admin' || role === 'manager'
    case 'settings':
      return role === 'admin'
    default:
      return true
  }
}

export function canVoidReceipt(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canAdjustReceipt(role: UserRole): boolean {
  return canVoidReceipt(role)
}

export function canEditProducts(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canDeleteProducts(role: UserRole): boolean {
  return role === 'admin'
}

export function canEditCustomers(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

export function canViewAllReports(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export const NAV_ITEMS: Array<{
  to: string
  label: string
  screen: ScreenKey
}> = [
  { to: '/dashboard', label: 'Dashboard', screen: 'dashboard' },
  { to: '/receipts/new', label: 'New Receipt', screen: 'new_receipt' },
  { to: '/receipts/preview', label: 'Receipt Preview', screen: 'receipt_preview' },
  { to: '/receipts', label: 'Receipt History', screen: 'receipt_history' },
  { to: '/products', label: 'Products', screen: 'products' },
  { to: '/customers', label: 'Customers', screen: 'customers' },
  { to: '/payments', label: 'Payments', screen: 'payments' },
  { to: '/reports', label: 'Reports', screen: 'reports' },
  { to: '/settings', label: 'Settings', screen: 'settings' }
]
