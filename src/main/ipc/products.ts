import { ipcMain } from 'electron'
import { getDb } from '../db'
import { canDeleteProducts, canEditProducts } from '../../shared/permissions'
import type { ProductRecord, Result } from '../../shared/types'
import { requireSession, writeAudit } from './session'

interface ProductRow {
  id: number
  name: string
  category: string
  unit: string
  unit_price: number
  track_stock: number
  stock_qty: number | null
  active: number
}

function mapProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    unitPriceKobo: row.unit_price,
    trackStock: row.track_stock === 1,
    stockQty: row.stock_qty,
    active: row.active === 1
  }
}

export function registerProductHandlers(): void {
  ipcMain.handle(
    'products:list',
    (_event, includeInactive = false): ProductRecord[] => {
      const user = requireSession()
      const sql = includeInactive
        ? 'SELECT * FROM products WHERE branch_id = ? ORDER BY name COLLATE NOCASE'
        : 'SELECT * FROM products WHERE branch_id = ? AND active = 1 ORDER BY name COLLATE NOCASE'
      return (getDb().prepare(sql).all(user.branchId) as ProductRow[]).map(mapProduct)
    }
  )

  ipcMain.handle(
    'products:save',
    (
      _event,
      input: {
        id?: number
        name: string
        category: string
        unit: string
        unitPriceKobo: number
        trackStock: boolean
        stockQty: number | null
        active: boolean
      }
    ): Result<ProductRecord> => {
      const user = requireSession()
      if (!canEditProducts(user.role)) {
        return { ok: false, error: 'You do not have permission to edit products.' }
      }
      const name = input.name?.trim()
      if (!name) return { ok: false, error: 'Product name is required.' }
      if (!Number.isInteger(input.unitPriceKobo) || input.unitPriceKobo < 0) {
        return { ok: false, error: 'Unit price is invalid.' }
      }

      const db = getDb()
      if (input.id) {
        db.prepare(
          `UPDATE products
           SET name = ?, category = ?, unit = ?, unit_price = ?, track_stock = ?, stock_qty = ?,
               active = ?, updated_at = datetime('now')
           WHERE id = ? AND branch_id = ?`
        ).run(
          name,
          input.category?.trim() ?? '',
          input.unit?.trim() || 'packet',
          input.unitPriceKobo,
          input.trackStock ? 1 : 0,
          input.stockQty,
          input.active ? 1 : 0,
          input.id,
          user.branchId
        )
        writeAudit(user.id, 'edit', 'product', input.id, { name })
      } else {
        const result = db
          .prepare(
            `INSERT INTO products (
               branch_id, name, category, unit, unit_price, track_stock, stock_qty, active
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            user.branchId,
            name,
            input.category?.trim() ?? '',
            input.unit?.trim() || 'packet',
            input.unitPriceKobo,
            input.trackStock ? 1 : 0,
            input.stockQty,
            input.active === false ? 0 : 1
          )
        input.id = Number(result.lastInsertRowid)
        writeAudit(user.id, 'create', 'product', input.id, { name })
      }

      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as ProductRow
      return { ok: true, data: mapProduct(row) }
    }
  )

  ipcMain.handle('products:deactivate', (_event, id: number): Result<{ id: number }> => {
    const user = requireSession()
    if (!canDeleteProducts(user.role)) {
      return { ok: false, error: 'Only an administrator can deactivate products.' }
    }
    getDb()
      .prepare(
        `UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ? AND branch_id = ?`
      )
      .run(id, user.branchId)
    writeAudit(user.id, 'delete', 'product', id, { deactivated: true })
    return { ok: true, data: { id } }
  })
}
