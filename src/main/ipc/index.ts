import bcrypt from 'bcryptjs'
import { app, ipcMain } from 'electron'
import { getDb, getDbPath, wipeDatabaseFiles } from '../db'
import { runFileBackup } from '../backup'
import {
  printReceipt,
  exportReceiptPdf,
  printTestPage,
  printCustomerStatement,
  exportCustomerStatementPdf,
  exportReportsPdf,
  printReports
} from '../print'
import type { AppContext, ChangePasswordResult, LoginResult, Result } from '../../shared/types'
import { registerCustomerHandlers } from './customers'
import { registerPaymentHandlers } from './payments'
import { registerProductHandlers } from './products'
import { registerReceiptHandlers } from './receipts'
import { registerReportHandlers } from './reports'
import { registerSettingsHandlers } from './settings'
import {
  getBranch,
  getCurrentSession,
  mapUser,
  readCounter,
  readSettings,
  requireRole,
  requireSession,
  setCurrentSession,
  writeAudit,
  type UserRow
} from './session'

export function registerIpcHandlers(): void {
  ipcMain.handle('auth:login', (_event, payload: { username: string; password: string }): LoginResult => {
    const username = payload.username?.trim() ?? ''
    const password = payload.password ?? ''

    if (!username || !password) {
      return { ok: false, error: 'Enter your username and password.' }
    }

    const row = getDb()
      .prepare(
        `SELECT id, branch_id, username, password_hash, full_name, role, active, must_change_password
         FROM users WHERE username = ? COLLATE NOCASE`
      )
      .get(username) as UserRow | undefined

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      writeAudit(row?.id ?? null, 'login_failed', 'user', row?.id ?? null, { username })
      return { ok: false, error: 'Invalid username or password.' }
    }

    if (row.active !== 1) {
      return { ok: false, error: 'This account has been deactivated. Contact an administrator.' }
    }

    const user = mapUser(row)
    setCurrentSession(user)
    writeAudit(user.id, 'login', 'user', user.id, { username: user.username })

    return { ok: true, user, branch: getBranch(user.branchId) }
  })

  ipcMain.handle('auth:logout', (): void => {
    const session = getCurrentSession()
    if (session) {
      writeAudit(session.id, 'logout', 'user', session.id, { username: session.username })
    }
    setCurrentSession(null)
  })

  ipcMain.handle('auth:session', () => getCurrentSession())

  ipcMain.handle(
    'auth:changePassword',
    (
      _event,
      payload: { currentPassword: string; newPassword: string }
    ): ChangePasswordResult => {
      const user = requireSession()
      const currentPassword = payload.currentPassword ?? ''
      const newPassword = payload.newPassword ?? ''

      if (newPassword.length < 8) {
        return { ok: false, error: 'New password must be at least 8 characters.' }
      }
      if (newPassword.toLowerCase() === 'changeme') {
        return { ok: false, error: 'Choose a password other than the default.' }
      }

      const row = getDb()
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(user.id) as { password_hash: string }

      if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
        return { ok: false, error: 'Current password is incorrect.' }
      }

      const passwordHash = bcrypt.hashSync(newPassword, 12)
      getDb()
        .prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
        .run(passwordHash, user.id)

      setCurrentSession({ ...user, mustChangePassword: false })
      writeAudit(user.id, 'edit', 'user', user.id, { field: 'password' })
      return { ok: true }
    }
  )

  ipcMain.handle(
    'app:factoryReset',
    (_event, payload: { password?: string; confirm?: string }): Result<string> => {
      const user = requireRole('admin')
      const password = payload?.password ?? ''
      const confirm = (payload?.confirm ?? '').trim().toUpperCase()
      const row = getDb()
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(user.id) as { password_hash: string } | undefined

      if (confirm !== 'DELETE') {
        return { ok: false, error: 'Type DELETE to confirm you want to erase all shop data.' }
      }
      if (!password || !row || !bcrypt.compareSync(password, row.password_hash)) {
        return { ok: false, error: 'Password is incorrect.' }
      }

      const backupPath = runFileBackup()
      wipeDatabaseFiles()
      app.relaunch()
      app.exit(0)
      return { ok: true, data: backupPath }
    }
  )

  ipcMain.handle('app:context', (): AppContext => {
    const user = requireSession()
    return {
      user,
      branch: getBranch(user.branchId),
      counter: readCounter(user.branchId),
      settings: readSettings(),
      dbPath: getDbPath()
    }
  })

  ipcMain.handle('receipts:print', (_event, id: number) => printReceipt(id))
  ipcMain.handle('receipts:pdf', (_event, id: number) => exportReceiptPdf(id))
  ipcMain.handle('receipts:printTest', () => printTestPage())
  ipcMain.handle('customers:printStatement', (_event, id: number) => printCustomerStatement(id))
  ipcMain.handle('customers:statementPdf', (_event, id: number) => exportCustomerStatementPdf(id))
  ipcMain.handle('reports:pdf', (_event, range: { fromDate: string; toDate: string }) =>
    exportReportsPdf(range)
  )
  ipcMain.handle('reports:print', (_event, range: { fromDate: string; toDate: string }) =>
    printReports(range)
  )

  ipcMain.handle('audit:list', () => {
    requireRole('admin')
    return getDb()
      .prepare(
        `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.timestamp, u.username
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC LIMIT 200`
      )
      .all() as Array<{
      id: number
      action: string
      entity: string
      entity_id: number | null
      details: string
      timestamp: string
      username: string | null
    }>
  })

  registerProductHandlers()
  registerCustomerHandlers()
  registerReceiptHandlers()
  registerPaymentHandlers()
  registerReportHandlers()
  registerSettingsHandlers()
}
