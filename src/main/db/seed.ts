import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'

/**
 * Real business data — seed verbatim. Do not invent placeholders.
 *
 * Receipt series continues the paper book: last paper #SA0000006781,
 * so the next digital receipt is SA0000006782.
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

const STAFF: Array<{ username: string; password: string; full_name: string; role: 'manager' | 'cashier' }> = [
  { username: 'manager', password: 'Topline123', full_name: 'Manager', role: 'manager' },
  { username: 'cashier', password: 'Topline123', full_name: 'Cashier', role: 'cashier' }
]

/** Unit prices from paper receipt SA0000006781 (ESSENCE ₦1,800, PET MALT ₦5,700). */
const PRODUCTS: Array<{ name: string; category: string; unit: string; unit_price: number }> = [
  { name: 'ESSENCE', category: 'Soft drinks', unit: 'packet', unit_price: 180_000 },
  { name: 'PET MALT', category: 'Malt drinks', unit: 'packet', unit_price: 570_000 }
]

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
  last_backup_at: '',
  open_at_login: '1'
}

export const STARTING_RECEIPT_NUMBER = 6782

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

    const insertUser = db.prepare(
      `INSERT INTO users (
         branch_id, username, password_hash, full_name, role, active, must_change_password
       ) VALUES (?, ?, ?, ?, ?, 1, 1)`
    )
    for (const staff of STAFF) {
      const exists = db
        .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
        .get(staff.username) as { id: number } | undefined
      if (!exists) {
        insertUser.run(
          branch.id,
          staff.username,
          bcrypt.hashSync(staff.password, 12),
          staff.full_name,
          staff.role
        )
      }
    }

    const counter = db
      .prepare('SELECT id, next_number FROM receipt_counters WHERE branch_id = ?')
      .get(branch.id) as { id: number; next_number: number } | undefined

    if (!counter) {
      db.prepare(
        `INSERT INTO receipt_counters (branch_id, prefix, next_number)
         VALUES (?, ?, ?)`
      ).run(branch.id, BRANCH.receipt_prefix, STARTING_RECEIPT_NUMBER)
    } else if (counter.next_number < STARTING_RECEIPT_NUMBER) {
      db.prepare('UPDATE receipt_counters SET next_number = ? WHERE id = ?').run(
        STARTING_RECEIPT_NUMBER,
        counter.id
      )
    }

    const insertProduct = db.prepare(
      `INSERT INTO products (branch_id, name, category, unit, unit_price, track_stock, stock_qty, active)
       VALUES (?, ?, ?, ?, ?, 0, NULL, 1)`
    )
    for (const product of PRODUCTS) {
      const exists = db
        .prepare('SELECT id FROM products WHERE branch_id = ? AND name = ? COLLATE NOCASE')
        .get(branch.id, product.name) as { id: number } | undefined
      if (!exists) {
        insertProduct.run(branch.id, product.name, product.category, product.unit, product.unit_price)
      }
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
