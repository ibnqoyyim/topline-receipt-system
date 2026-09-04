import type Database from 'better-sqlite3'
import { INITIAL_SCHEMA_SQL } from './schema'

interface Migration {
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    sql: INITIAL_SCHEMA_SQL
  }
]

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)

  const alreadyApplied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => (row as { name: string }).name)
  )

  const insertMigration = db.prepare(
    `INSERT INTO schema_migrations (name, applied_at) VALUES (?, datetime('now'))`
  )

  for (const migration of MIGRATIONS) {
    if (alreadyApplied.has(migration.name)) continue

    const apply = db.transaction(() => {
      db.exec(migration.sql)
      insertMigration.run(migration.name)
    })
    apply()
  }
}
