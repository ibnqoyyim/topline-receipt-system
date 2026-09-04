import bcrypt from 'bcryptjs'
import { copyFileSync } from 'fs'
import { basename } from 'path'
import { dialog, ipcMain } from 'electron'
import { getDb, getDbPath, closeDatabase, initDatabase } from '../db'
import { getMainWindow } from '../window'
import type { AppSettings, PrinterInfo, Result, StaffUser, UserRole } from '../../shared/types'
import {
  getBranch,
  readCounter,
  readSettings,
  requireRole,
  requireSession,
  upsertSetting,
  writeAudit
} from './session'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    const user = requireRole('admin')
    return {
      settings: readSettings(),
      branch: getBranch(user.branchId),
      counter: readCounter(user.branchId),
      dbPath: getDbPath()
    }
  })

  ipcMain.handle(
    'settings:save',
    (
      _event,
      input: {
        branch: { name: string; address: string; phone: string; email: string; receiptPrefix: string }
        nextNumber: number
        settings: {
          printerWidth: '58mm' | '80mm'
          printerName: string
          taxEnabled: boolean
          taxPercent: string
          discountEnabled: boolean
          idleLogoutMinutes: number
          stockTrackingEnabled: boolean
          backupReminderDays: number
          debtAlertKobo: number
        }
      }
    ): Result<AppSettings> => {
      const user = requireRole('admin')
      const prefix = input.branch.receiptPrefix?.trim().toUpperCase()
      if (!prefix || prefix.length > 4) {
        return { ok: false, error: 'Receipt prefix should be 1–4 letters (e.g. SA).' }
      }
      if (!Number.isInteger(input.nextNumber) || input.nextNumber < 1) {
        return { ok: false, error: 'Next receipt number must be a whole number of 1 or higher.' }
      }

      const db = getDb()
      db.prepare(
        `UPDATE branches SET name = ?, address = ?, phone = ?, email = ?, receipt_prefix = ? WHERE id = ?`
      ).run(
        input.branch.name.trim(),
        input.branch.address.trim(),
        input.branch.phone.trim(),
        input.branch.email.trim(),
        prefix,
        user.branchId
      )
      db.prepare('UPDATE receipt_counters SET prefix = ?, next_number = ? WHERE branch_id = ?').run(
        prefix,
        input.nextNumber,
        user.branchId
      )

      upsertSetting('printer_width', input.settings.printerWidth)
      upsertSetting('printer_name', input.settings.printerName ?? '')
      upsertSetting('tax_enabled', input.settings.taxEnabled ? '1' : '0')
      upsertSetting('tax_percent', input.settings.taxPercent || '0')
      upsertSetting('discount_enabled', input.settings.discountEnabled ? '1' : '0')
      upsertSetting('idle_logout_minutes', String(input.settings.idleLogoutMinutes || 15))
      upsertSetting('stock_tracking_enabled', input.settings.stockTrackingEnabled ? '1' : '0')
      upsertSetting('backup_reminder_days', String(input.settings.backupReminderDays || 7))
      upsertSetting('debt_alert_kobo', String(input.settings.debtAlertKobo || 0))

      writeAudit(user.id, 'edit', 'settings', user.branchId, { prefix, nextNumber: input.nextNumber })
      return { ok: true, data: readSettings() }
    }
  )

  ipcMain.handle('settings:users', (): StaffUser[] => {
    const user = requireRole('admin')
    const rows = getDb()
      .prepare(
        `SELECT id, username, full_name, role, active, must_change_password
         FROM users WHERE branch_id = ? ORDER BY username`
      )
      .all(user.branchId) as Array<{
      id: number
      username: string
      full_name: string
      role: UserRole
      active: number
      must_change_password: number
    }>
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      active: row.active === 1,
      mustChangePassword: row.must_change_password === 1
    }))
  })

  ipcMain.handle(
    'settings:saveUser',
    (
      _event,
      input: {
        id?: number
        username: string
        fullName: string
        role: UserRole
        password?: string
        active: boolean
        mustChangePassword: boolean
      }
    ): Result<StaffUser> => {
      const admin = requireRole('admin')
      const username = input.username?.trim()
      const fullName = input.fullName?.trim()
      if (!username || !fullName) {
        return { ok: false, error: 'Username and full name are required.' }
      }
      if (!['admin', 'manager', 'cashier'].includes(input.role)) {
        return { ok: false, error: 'Role is invalid.' }
      }

      const db = getDb()
      try {
        if (input.id) {
          if (input.id === admin.id && input.active === false) {
            return { ok: false, error: 'You cannot deactivate your own account.' }
          }
          if (input.password) {
            if (input.password.length < 8) {
              return { ok: false, error: 'Password must be at least 8 characters.' }
            }
            db.prepare(
              `UPDATE users SET username = ?, full_name = ?, role = ?, active = ?, must_change_password = ?, password_hash = ?
               WHERE id = ? AND branch_id = ?`
            ).run(
              username,
              fullName,
              input.role,
              input.active ? 1 : 0,
              input.mustChangePassword ? 1 : 0,
              bcrypt.hashSync(input.password, 12),
              input.id,
              admin.branchId
            )
          } else {
            db.prepare(
              `UPDATE users SET username = ?, full_name = ?, role = ?, active = ?, must_change_password = ?
               WHERE id = ? AND branch_id = ?`
            ).run(
              username,
              fullName,
              input.role,
              input.active ? 1 : 0,
              input.mustChangePassword ? 1 : 0,
              input.id,
              admin.branchId
            )
          }
          writeAudit(admin.id, 'edit', 'user', input.id, { username })
        } else {
          if (!input.password || input.password.length < 8) {
            return { ok: false, error: 'New users need a password of at least 8 characters.' }
          }
          const result = db
            .prepare(
              `INSERT INTO users (branch_id, username, password_hash, full_name, role, active, must_change_password)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              admin.branchId,
              username,
              bcrypt.hashSync(input.password, 12),
              fullName,
              input.role,
              input.active ? 1 : 0,
              input.mustChangePassword ? 1 : 0
            )
          input.id = Number(result.lastInsertRowid)
          writeAudit(admin.id, 'create', 'user', input.id, { username })
        }

        const row = db
          .prepare(
            `SELECT id, username, full_name, role, active, must_change_password FROM users WHERE id = ?`
          )
          .get(input.id) as {
          id: number
          username: string
          full_name: string
          role: UserRole
          active: number
          must_change_password: number
        }
        return {
          ok: true,
          data: {
            id: row.id,
            username: row.username,
            fullName: row.full_name,
            role: row.role,
            active: row.active === 1,
            mustChangePassword: row.must_change_password === 1
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save user.'
        if (message.includes('UNIQUE')) {
          return { ok: false, error: 'That username is already in use.' }
        }
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle('settings:backup', async (): Promise<Result<string>> => {
    const user = requireRole('admin')
    const result = await dialog.showSaveDialog({
      title: 'Backup Topline database',
      defaultPath: `topline-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite database', extensions: ['db'] }]
    })
    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'Backup cancelled.' }
    }
    getDb().pragma('wal_checkpoint(FULL)')
    copyFileSync(getDbPath(), result.filePath)
    upsertSetting('last_backup_at', new Date().toISOString())
    writeAudit(user.id, 'create', 'backup', null, { path: result.filePath })
    return { ok: true, data: result.filePath }
  })

  ipcMain.handle('settings:restore', async (): Promise<Result<string>> => {
    const user = requireRole('admin')
    const picked = await dialog.showOpenDialog({
      title: 'Restore Topline database',
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (picked.canceled || !picked.filePaths[0]) {
      return { ok: false, error: 'Restore cancelled.' }
    }
    const source = picked.filePaths[0]
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      cancelId: 0,
      title: 'Restore database',
      message: `Replace the current database with ${basename(source)}?`,
      detail: 'This cannot be undone. Take a backup first if you are not sure.'
    })
    if (confirmed.response !== 1) {
      return { ok: false, error: 'Restore cancelled.' }
    }
    closeDatabase()
    copyFileSync(source, getDbPath())
    initDatabase()
    writeAudit(user.id, 'edit', 'backup', null, { restoredFrom: source })
    return { ok: true, data: source }
  })

  ipcMain.handle('printers:list', async (): Promise<PrinterInfo[]> => {
    requireSession()
    const win = getMainWindow()
    if (!win) return []
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      isDefault: Boolean((printer as { isDefault?: boolean }).isDefault)
    }))
  })
}
