import { copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getDb, getDbPath } from './db'
import { readSettings, upsertSetting } from './ipc/session'

export function shopBackupDir(): string {
  return join(app.getPath('desktop'), 'Topline Backups')
}

export function runFileBackup(): string {
  const dir = shopBackupDir()
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dest = join(dir, `topline-backup-${stamp}.db`)
  getDb().pragma('wal_checkpoint(FULL)')
  copyFileSync(getDbPath(), dest)
  upsertSetting('last_backup_at', new Date().toISOString())
  return dest
}

export function ensureFirstBackup(): void {
  if (!readSettings().lastBackupAt) {
    runFileBackup()
  }
}
