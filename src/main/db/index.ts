import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { migrate } from './migrate'
import { seed } from './seed'

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'topline.db')
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database has not been initialized')
  }
  return db
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  migrate(db)
  seed(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function reopenDatabase(): ReturnType<typeof initDatabase> {
  closeDatabase()
  return initDatabase()
}

