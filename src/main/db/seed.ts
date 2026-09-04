import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'

/**
 * Real business data — seed verbatim. Do not invent placeholders.
 *
 * RECEIPT NUMBER QUESTION (flagged, not guessed):
 * Paper receipts are already at #SA0000006781.
 * This seed starts next_number at 1 (SA0000000001) as requested for a fresh
 * digital sequence. Confirm if you want next_number = 6782 instead so the
 * digital series continues from the paper book.
 */
const BRANCH = {
  name: 'Topline Stores (Division of Topline Realtor & Investment Ltd)',
  address: 'Beside Ajanaku Guest House, Sawmill Area, Ido-Osun, Osun State',
  phone: '07031594752, 08035827630',
  email: 'ajibadeolufunke@gmail.com',
  receipt_prefix: 'SA'
}

const ADMIN = {
  username: 'admin',
  password: 'changeme',
  full_name: 'Administrator',
  role: 'admin'
}

const DEFAULT_SETTINGS: Record<string, string> = {
  printer_width: '80mm',
  printer_name: '',
  tax_enabled: '0',
  tax_percent: '0',
  discount_enabled: '0',
  idle_logout_minutes: '15',
  stock_tracking_enabled: '0',
  backup_reminder_days: '7',
  debt_alert_kobo: '5000000',
  last_backup_at: ''
}

export const STARTING_RECEIPT_NUMBER = 1

export function seed(db: Database.Database): void {
  const apply = db.transaction(() => {
    let branch = db
      .prepare('SELECT id FROM branches WHERE receipt_prefix = ?')
      .get(BRANCH.receipt_prefix) as { id: number } | undefined

    if (!branch) {
      const result = db
        .prepare(
          `INSERT INTO branches (name, address, phone, email, receipt_prefix)
           VALUES (@name, @address, @phone, @email, @receipt_prefix)`
        )
        .run(BRANCH)
      branch = { id: Number(result.lastInsertRowid) }
    }

    const existingAdmin = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(ADMIN.username) as { id: number } | undefined

    if (!existingAdmin) {
      const passwordHash = bcrypt.hashSync(ADMIN.password, 12)
      db.prepare(
        `INSERT INTO users (
           branch_id, username, password_hash, full_name, role, active, must_change_password
         ) VALUES (?, ?, ?, ?, ?, 1, 1)`
      ).run(branch.id, ADMIN.username, passwordHash, ADMIN.full_name, ADMIN.role)
    }

    const counter = db
      .prepare('SELECT id FROM receipt_counters WHERE branch_id = ?')
      .get(branch.id) as { id: number } | undefined

    if (!counter) {
      db.prepare(
        `INSERT INTO receipt_counters (branch_id, prefix, next_number)
         VALUES (?, ?, ?)`
      ).run(branch.id, BRANCH.receipt_prefix, STARTING_RECEIPT_NUMBER)
    }

    const insertSetting = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`
    )
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value)
    }
  })

  apply()
}
