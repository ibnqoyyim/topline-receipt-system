import { ipcMain } from 'electron'
import { getDb } from '../db'
import { formatReceiptNumber, nowLocalIso } from '../../shared/format'
import { percentOfKobo } from '../../shared/money'
import { canAdjustReceipt, canVoidReceipt } from '../../shared/permissions'
import type {
  AdjustReceiptInput,
  PaymentMethod,
  ReceiptAdjustment,
  ReceiptDetail,
  ReceiptItemRecord,
  ReceiptSummary,
  Result,
  SaveReceiptInput
} from '../../shared/types'
import { getBranch, readSettings, requireSession, writeAudit } from './session'

interface ReceiptRow {
  id: number
  branch_id: number
  receipt_number: string
  customer_id: number | null
  cashier_id: number
  receipt_date: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  payment_method: PaymentMethod
  amount_paid: number
  balance_before: number
  balance_after: number
  status: 'active' | 'voided'
  notes: string
  customer_name: string | null
  cashier_name: string
}

function mapSummary(row: ReceiptRow): ReceiptSummary {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    customerId: row.customer_id,
    customerName: row.customer_name ?? 'Walk-in / Cash customer',
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    receiptDate: row.receipt_date,
    totalKobo: row.total,
    amountPaidKobo: row.amount_paid,
    paymentMethod: row.payment_method,
    status: row.status,
    balanceAfterKobo: row.balance_after
  }
}

function loadReceipt(id: number, branchId: number): ReceiptDetail | null {
  const row = getDb()
    .prepare(
      `SELECT r.*, c.name AS customer_name, u.username AS cashier_name
       FROM receipts r
       LEFT JOIN customers c ON c.id = r.customer_id
       JOIN users u ON u.id = r.cashier_id
       WHERE r.id = ? AND r.branch_id = ?`
    )
    .get(id, branchId) as ReceiptRow | undefined

  if (!row) return null

  const items = getDb()
    .prepare(
      `SELECT id, product_id, description, qty, unit_price, line_total
       FROM receipt_items WHERE receipt_id = ? ORDER BY id`
    )
    .all(id) as Array<{
    id: number
    product_id: number | null
    description: string
    qty: number
    unit_price: number
    line_total: number
  }>

  const mappedItems: ReceiptItemRecord[] = items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    description: item.description,
    qty: item.qty,
    unitPriceKobo: item.unit_price,
    lineTotalKobo: item.line_total
  }))

  const adjustments = getDb()
    .prepare(
      `SELECT a.id, a.reason, a.created_at, u.username
       FROM receipt_adjustments a
       JOIN users u ON u.id = a.user_id
       WHERE a.receipt_id = ?
       ORDER BY a.id DESC`
    )
    .all(id) as Array<{ id: number; reason: string; created_at: string; username: string }>

  const mappedAdjustments: ReceiptAdjustment[] = adjustments.map((row) => ({
    id: row.id,
    username: row.username,
    reason: row.reason,
    createdAt: row.created_at
  }))

  return {
    ...mapSummary(row),
    branch: getBranch(branchId),
    subtotalKobo: row.subtotal,
    taxKobo: row.tax_amount,
    discountKobo: row.discount_amount,
    balanceBeforeKobo: row.balance_before,
    notes: row.notes,
    items: mappedItems,
    adjusted: mappedAdjustments.length > 0,
    adjustments: mappedAdjustments
  }
}

function computeTotals(
  items: SaveReceiptInput['items'],
  discountKobo: number,
  taxEnabled: boolean,
  taxPercent: string
): { computedItems: Array<SaveReceiptInput['items'][number] & { lineTotal: number }>; subtotal: number; taxAmount: number; discountAmount: number; total: number } {
  let lineSum = 0
  const computedItems = items.map((item) => {
    const lineTotal = item.qty * item.unitPriceKobo
    lineSum += lineTotal
    return { ...item, description: item.description.trim().toUpperCase(), lineTotal }
  })
  const subtotal = lineSum
  const taxAmount = taxEnabled ? percentOfKobo(subtotal, taxPercent) : 0
  const discountAmount = Math.max(0, discountKobo)
  if (discountAmount > subtotal + taxAmount) {
    throw new Error('Discount cannot exceed the receipt total before discount.')
  }
  return { computedItems, subtotal, taxAmount, discountAmount, total: subtotal + taxAmount - discountAmount }
}

function snapshotReceipt(detail: ReceiptDetail): Record<string, unknown> {
  return {
    receiptNumber: detail.receiptNumber,
    customerId: detail.customerId,
    customerName: detail.customerName,
    items: detail.items,
    subtotalKobo: detail.subtotalKobo,
    taxKobo: detail.taxKobo,
    discountKobo: detail.discountKobo,
    totalKobo: detail.totalKobo,
    paymentMethod: detail.paymentMethod,
    amountPaidKobo: detail.amountPaidKobo,
    balanceBeforeKobo: detail.balanceBeforeKobo,
    balanceAfterKobo: detail.balanceAfterKobo,
    notes: detail.notes
  }
}

function saveReceipt(input: SaveReceiptInput): Result<ReceiptDetail> {
  const user = requireSession()
  const items = (input.items ?? []).filter((item) => item.description.trim().length > 0)

  if (items.length === 0) {
    return { ok: false, error: 'Add at least one line item.' }
  }

  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return { ok: false, error: `Quantity must be a whole number greater than 0 (${item.description}).` }
    }
    if (!Number.isInteger(item.unitPriceKobo) || item.unitPriceKobo < 0) {
      return { ok: false, error: `Unit price is invalid (${item.description}).` }
    }
  }

  if (!Number.isInteger(input.amountPaidKobo) || input.amountPaidKobo < 0) {
    return { ok: false, error: 'Amount paid is invalid.' }
  }

  const settings = readSettings()
  const db = getDb()

  try {
    const receiptId = db.transaction(() => {
      const { computedItems, subtotal, taxAmount, discountAmount, total } = computeTotals(
        items,
        settings.discountEnabled ? input.discountKobo : 0,
        settings.taxEnabled,
        settings.taxPercent
      )
      const newDebt = total - input.amountPaidKobo

      let balanceBefore = 0
      if (input.customerId) {
        const customer = db
          .prepare('SELECT id, current_balance FROM customers WHERE id = ? AND branch_id = ?')
          .get(input.customerId, user.branchId) as { id: number; current_balance: number } | undefined
        if (!customer) {
          throw new Error('Customer was not found.')
        }
        balanceBefore = customer.current_balance
      }
      const balanceAfter = balanceBefore + newDebt

      const counter = db
        .prepare(
          'SELECT prefix, next_number FROM receipt_counters WHERE branch_id = ?'
        )
        .get(user.branchId) as { prefix: string; next_number: number } | undefined
      if (!counter) {
        throw new Error('Receipt counter is missing for this branch.')
      }

      const receiptNumber = formatReceiptNumber(counter.prefix, counter.next_number)
      db.prepare(
        'UPDATE receipt_counters SET next_number = next_number + 1 WHERE branch_id = ?'
      ).run(user.branchId)

      const receiptDate = nowLocalIso()
      const insert = db
        .prepare(
          `INSERT INTO receipts (
             branch_id, receipt_number, customer_id, cashier_id, receipt_date,
             subtotal, tax_amount, discount_amount, total, payment_method, amount_paid,
             balance_before, balance_after, status, notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
        )
        .run(
          user.branchId,
          receiptNumber,
          input.customerId,
          user.id,
          receiptDate,
          subtotal,
          taxAmount,
          discountAmount,
          total,
          input.paymentMethod,
          input.amountPaidKobo,
          balanceBefore,
          balanceAfter,
          input.notes?.trim() ?? ''
        )

      const id = Number(insert.lastInsertRowid)
      const insertItem = db.prepare(
        `INSERT INTO receipt_items (receipt_id, product_id, description, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      for (const item of computedItems) {
        insertItem.run(id, item.productId, item.description, item.qty, item.unitPriceKobo, item.lineTotal)
        if (
          settings.stockTrackingEnabled &&
          item.productId &&
          Number.isInteger(item.qty)
        ) {
          db.prepare(
            `UPDATE products
             SET stock_qty = CASE WHEN track_stock = 1 AND stock_qty IS NOT NULL
               THEN stock_qty - ? ELSE stock_qty END,
                 updated_at = datetime('now')
             WHERE id = ? AND branch_id = ?`
          ).run(item.qty, item.productId, user.branchId)
        }
      }

      if (input.customerId) {
        db.prepare('UPDATE customers SET current_balance = ? WHERE id = ?').run(
          balanceAfter,
          input.customerId
        )
        if (input.amountPaidKobo > 0) {
          db.prepare(
            `INSERT INTO payments (
               branch_id, customer_id, receipt_id, amount, method, payment_date, recorded_by, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            user.branchId,
            input.customerId,
            id,
            input.amountPaidKobo,
            input.paymentMethod,
            receiptDate,
            user.id,
            'Receipt payment'
          )
        }
      }

      writeAudit(user.id, 'create', 'receipt', id, { receiptNumber, total, customerId: input.customerId })
      return id
    })()

    const saved = loadReceipt(receiptId, user.branchId)
    if (!saved) {
      return { ok: false, error: 'Receipt was saved but could not be reloaded.' }
    }
    return { ok: true, data: saved }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save receipt.' }
  }
}

function voidReceipt(id: number): Result<ReceiptDetail> {
  const user = requireSession()
  if (!canVoidReceipt(user.role)) {
    return { ok: false, error: 'Only an administrator can void receipts.' }
  }

  const db = getDb()
  try {
    db.transaction(() => {
      const row = db
        .prepare('SELECT * FROM receipts WHERE id = ? AND branch_id = ?')
        .get(id, user.branchId) as {
        id: number
        status: string
        customer_id: number | null
        balance_before: number
        balance_after: number
        receipt_number: string
      } | undefined

      if (!row) throw new Error('Receipt was not found.')
      if (row.status === 'voided') throw new Error('This receipt is already voided.')

      db.prepare(`UPDATE receipts SET status = 'voided' WHERE id = ?`).run(id)

      const newDebt = row.balance_after - row.balance_before
      if (row.customer_id) {
        db.prepare(
          'UPDATE customers SET current_balance = current_balance - ? WHERE id = ?'
        ).run(newDebt, row.customer_id)
      }

      const settings = readSettings()
      if (settings.stockTrackingEnabled) {
        const lines = db
          .prepare('SELECT product_id, qty FROM receipt_items WHERE receipt_id = ?')
          .all(id) as Array<{ product_id: number | null; qty: number }>
        for (const line of lines) {
          if (!line.product_id) continue
          db.prepare(
            `UPDATE products
             SET stock_qty = CASE WHEN track_stock = 1 AND stock_qty IS NOT NULL
               THEN stock_qty + ? ELSE stock_qty END,
                 updated_at = datetime('now')
             WHERE id = ?`
          ).run(line.qty, line.product_id)
        }
      }

      writeAudit(user.id, 'void', 'receipt', id, { receiptNumber: row.receipt_number })
    })()

    const updated = loadReceipt(id, user.branchId)
    if (!updated) return { ok: false, error: 'Receipt was voided but could not be reloaded.' }
    return { ok: true, data: updated }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not void receipt.' }
  }
}

export function registerReceiptHandlers(): void {
  ipcMain.handle('receipts:save', (_event, input: SaveReceiptInput): Result<ReceiptDetail> => {
    return saveReceipt(input)
  })

  ipcMain.handle('receipts:get', (_event, id: number): Result<ReceiptDetail> => {
    const user = requireSession()
    const receipt = loadReceipt(id, user.branchId)
    if (!receipt) return { ok: false, error: 'Receipt was not found.' }
    return { ok: true, data: receipt }
  })

  ipcMain.handle(
    'receipts:list',
    (
      _event,
      filters: {
        query?: string
        fromDate?: string
        toDate?: string
        cashierId?: number | null
        status?: 'active' | 'voided' | 'all'
      }
    ): ReceiptSummary[] => {
      const user = requireSession()
      const clauses = ['r.branch_id = ?']
      const params: Array<string | number> = [user.branchId]

      if (filters?.status && filters.status !== 'all') {
        clauses.push('r.status = ?')
        params.push(filters.status)
      }
      if (filters?.fromDate) {
        clauses.push('substr(r.receipt_date, 1, 10) >= ?')
        params.push(filters.fromDate)
      }
      if (filters?.toDate) {
        clauses.push('substr(r.receipt_date, 1, 10) <= ?')
        params.push(filters.toDate)
      }
      if (filters?.cashierId) {
        clauses.push('r.cashier_id = ?')
        params.push(filters.cashierId)
      }
      if (filters?.query?.trim()) {
        clauses.push(
          `(r.receipt_number LIKE ? OR IFNULL(c.name, '') LIKE ? OR u.username LIKE ?)`
        )
        const like = `%${filters.query.trim()}%`
        params.push(like, like, like)
      }

      const rows = getDb()
        .prepare(
          `SELECT r.*, c.name AS customer_name, u.username AS cashier_name
           FROM receipts r
           LEFT JOIN customers c ON c.id = r.customer_id
           JOIN users u ON u.id = r.cashier_id
           WHERE ${clauses.join(' AND ')}
           ORDER BY r.id DESC
           LIMIT 500`
        )
        .all(...params) as ReceiptRow[]

      return rows.map(mapSummary)
    }
  )

  ipcMain.handle('receipts:void', (_event, id: number): Result<ReceiptDetail> => voidReceipt(id))
  ipcMain.handle(
    'receipts:adjust',
    (_event, payload: { id: number } & AdjustReceiptInput): Result<ReceiptDetail> =>
      adjustReceipt(payload.id, payload)
  )
}

function applyStockDelta(
  db: ReturnType<typeof getDb>,
  branchId: number,
  lines: Array<{ productId: number | null; qty: number }>,
  direction: 1 | -1
): void {
  const settings = readSettings()
  if (!settings.stockTrackingEnabled) return
  for (const line of lines) {
    if (!line.productId || !Number.isInteger(line.qty)) continue
    db.prepare(
      `UPDATE products
       SET stock_qty = CASE WHEN track_stock = 1 AND stock_qty IS NOT NULL
         THEN stock_qty + ? ELSE stock_qty END,
           updated_at = datetime('now')
       WHERE id = ? AND branch_id = ?`
    ).run(direction * line.qty, line.productId, branchId)
  }
}

function adjustReceipt(id: number, input: AdjustReceiptInput): Result<ReceiptDetail> {
  const user = requireSession()
  if (!canAdjustReceipt(user.role)) {
    return { ok: false, error: 'You do not have permission to adjust receipts.' }
  }
  const reason = input.reason?.trim()
  if (!reason) {
    return { ok: false, error: 'Enter a reason for this adjustment.' }
  }

  const items = (input.items ?? []).filter((item) => item.description.trim().length > 0)
  if (items.length === 0) {
    return { ok: false, error: 'Add at least one line item.' }
  }
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return { ok: false, error: `Quantity must be a whole number greater than 0 (${item.description}).` }
    }
    if (!Number.isInteger(item.unitPriceKobo) || item.unitPriceKobo < 0) {
      return { ok: false, error: `Unit price is invalid (${item.description}).` }
    }
  }
  if (!Number.isInteger(input.amountPaidKobo) || input.amountPaidKobo < 0) {
    return { ok: false, error: 'Amount paid is invalid.' }
  }

  const settings = readSettings()
  const db = getDb()

  try {
    db.transaction(() => {
      const existing = loadReceipt(id, user.branchId)
      if (!existing) throw new Error('Receipt was not found.')
      if (existing.status === 'voided') throw new Error('Voided receipts cannot be adjusted.')

      const { computedItems, subtotal, taxAmount, discountAmount, total } = computeTotals(
        items,
        settings.discountEnabled ? input.discountKobo : 0,
        settings.taxEnabled,
        settings.taxPercent
      )
      const newDebt = total - input.amountPaidKobo
      const oldNewDebt = existing.totalKobo - existing.amountPaidKobo

      if (existing.customerId) {
        db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(
          oldNewDebt,
          existing.customerId
        )
      }

      let balanceBefore = existing.balanceBeforeKobo
      if (input.customerId !== existing.customerId) {
        if (input.customerId) {
          const customer = db
            .prepare('SELECT current_balance FROM customers WHERE id = ? AND branch_id = ?')
            .get(input.customerId, user.branchId) as { current_balance: number } | undefined
          if (!customer) throw new Error('Customer was not found.')
          balanceBefore = customer.current_balance
        } else {
          balanceBefore = 0
        }
      }

      const balanceAfter = input.customerId ? balanceBefore + newDebt : 0

      if (input.customerId) {
        db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?').run(
          newDebt,
          input.customerId
        )
      }

      applyStockDelta(
        db,
        user.branchId,
        existing.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        1
      )
      applyStockDelta(
        db,
        user.branchId,
        computedItems.map((item) => ({ productId: item.productId, qty: item.qty })),
        -1
      )

      db.prepare(
        `UPDATE receipts
         SET customer_id = ?, subtotal = ?, tax_amount = ?, discount_amount = ?, total = ?,
             payment_method = ?, amount_paid = ?, balance_before = ?, balance_after = ?, notes = ?
         WHERE id = ? AND branch_id = ?`
      ).run(
        input.customerId,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        input.paymentMethod,
        input.amountPaidKobo,
        balanceBefore,
        balanceAfter,
        input.notes?.trim() ?? '',
        id,
        user.branchId
      )

      db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').run(id)
      const insertItem = db.prepare(
        `INSERT INTO receipt_items (receipt_id, product_id, description, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const item of computedItems) {
        insertItem.run(id, item.productId, item.description, item.qty, item.unitPriceKobo, item.lineTotal)
      }

      db.prepare('DELETE FROM payments WHERE receipt_id = ?').run(id)
      if (input.customerId && input.amountPaidKobo > 0) {
        db.prepare(
          `INSERT INTO payments (
             branch_id, customer_id, receipt_id, amount, method, payment_date, recorded_by, notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          user.branchId,
          input.customerId,
          id,
          input.amountPaidKobo,
          input.paymentMethod,
          existing.receiptDate,
          user.id,
          'Adjusted receipt payment'
        )
      }

      const updated = loadReceipt(id, user.branchId)
      if (!updated) throw new Error('Adjusted receipt could not be reloaded.')

      db.prepare(
        `INSERT INTO receipt_adjustments (receipt_id, user_id, reason, before_json, after_json)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        id,
        user.id,
        reason,
        JSON.stringify(snapshotReceipt(existing)),
        JSON.stringify(snapshotReceipt(updated))
      )
      writeAudit(user.id, 'edit', 'receipt', id, {
        receiptNumber: existing.receiptNumber,
        reason,
        discountOverride: discountAmount !== existing.discountKobo
      })
    })()

    const saved = loadReceipt(id, user.branchId)
    if (!saved) return { ok: false, error: 'Receipt was adjusted but could not be reloaded.' }
    return { ok: true, data: saved }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not adjust receipt.' }
  }
}

export { loadReceipt }
