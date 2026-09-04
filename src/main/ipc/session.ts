import { getDb } from '../db'
import type {
  AppSettings,
  BranchInfo,
  ReceiptCounterInfo,
  SessionUser,
  UserRole
} from '../../shared/types'

interface UserRow {
  id: number
  branch_id: number
  username: string
  password_hash: string
  full_name: string
  role: UserRole
  active: number
  must_change_password: number
}

interface BranchRow {
  id: number
  name: string
  address: string
  phone: string
  email: string
  receipt_prefix: string
}

let currentSession: SessionUser | null = null

export function getCurrentSession(): SessionUser | null {
  return currentSession
}

export function setCurrentSession(session: SessionUser | null): void {
  currentSession = session
}

export function mapUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    branchId: row.branch_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password === 1
  }
}

export function requireSession(): SessionUser {
  if (!currentSession) {
    throw new Error('Not signed in')
  }
  return currentSession
}

export function requireRole(...roles: UserRole[]): SessionUser {
  const user = requireSession()
  if (!roles.includes(user.role)) {
    throw new Error('You do not have permission to do that.')
  }
  return user
}

export function getBranch(branchId: number): BranchInfo {
  const row = getDb()
    .prepare(
      `SELECT id, name, address, phone, email, receipt_prefix
       FROM branches WHERE id = ?`
    )
    .get(branchId) as BranchRow | undefined

  if (!row) {
    throw new Error('Branch record is missing')
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    receiptPrefix: row.receipt_prefix
  }
}

export function writeAudit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  details: Record<string, unknown>
): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, action, entity, entityId, JSON.stringify(details))
}

export function readSettings(): AppSettings {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]))

  return {
    printerWidth: map.printer_width === '58mm' ? '58mm' : '80mm',
    printerName: map.printer_name ?? '',
    taxEnabled: map.tax_enabled === '1',
    taxPercent: map.tax_percent ?? '0',
    discountEnabled: map.discount_enabled === '1',
    idleLogoutMinutes: Number(map.idle_logout_minutes ?? 15),
    stockTrackingEnabled: map.stock_tracking_enabled === '1',
    backupReminderDays: Number(map.backup_reminder_days ?? 7),
    debtAlertKobo: Number(map.debt_alert_kobo ?? 5_000_000),
    lastBackupAt: map.last_backup_at ?? ''
  }
}

export function readCounter(branchId: number): ReceiptCounterInfo {
  const row = getDb()
    .prepare('SELECT prefix, next_number FROM receipt_counters WHERE branch_id = ?')
    .get(branchId) as { prefix: string; next_number: number } | undefined

  if (!row) {
    throw new Error('Receipt counter is missing for this branch')
  }

  return { prefix: row.prefix, nextNumber: row.next_number }
}

export function upsertSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

export type { UserRow }
