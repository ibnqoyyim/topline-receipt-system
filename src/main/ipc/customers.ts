import { ipcMain } from 'electron'
import { getDb } from '../db'
import { canEditCustomers } from '../../shared/permissions'
import type { CustomerRecord, PaymentRecord, ReceiptSummary, Result } from '../../shared/types'
import { requireSession, writeAudit } from './session'

interface CustomerRow {
  id: number
  name: string
  phone: string
  address: string
  notes: string
  opening_balance: number
  current_balance: number
  created_at: string
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    openingBalanceKobo: row.opening_balance,
    currentBalanceKobo: row.current_balance,
    createdAt: row.created_at
  }
}

export function registerCustomerHandlers(): void {
  ipcMain.handle(
    'customers:list',
    (
      _event,
      filters?: { query?: string; balance?: 'all' | 'owing' | 'settled' }
    ): CustomerRecord[] => {
      const user = requireSession()
      const clauses = ['branch_id = ?']
      const params: Array<string | number> = [user.branchId]
      if (filters?.query?.trim()) {
        clauses.push('(name LIKE ? OR phone LIKE ?)')
        const like = `%${filters.query.trim()}%`
        params.push(like, like)
      }
      if (filters?.balance === 'owing') clauses.push('current_balance > 0')
      if (filters?.balance === 'settled') clauses.push('current_balance <= 0')

      const rows = getDb()
        .prepare(
          `SELECT * FROM customers WHERE ${clauses.join(' AND ')} ORDER BY name COLLATE NOCASE`
        )
        .all(...params) as CustomerRow[]
      return rows.map(mapCustomer)
    }
  )

  ipcMain.handle('customers:get', (_event, id: number): Result<CustomerRecord> => {
    const user = requireSession()
    const row = getDb()
      .prepare('SELECT * FROM customers WHERE id = ? AND branch_id = ?')
      .get(id, user.branchId) as CustomerRow | undefined
    if (!row) return { ok: false, error: 'Customer was not found.' }
    return { ok: true, data: mapCustomer(row) }
  })

  ipcMain.handle(
    'customers:save',
    (
      _event,
      input: {
        id?: number
        name: string
        phone: string
        address: string
        notes: string
        openingBalanceKobo?: number
      }
    ): Result<CustomerRecord> => {
      const user = requireSession()
      const name = input.name?.trim()
      if (!name) return { ok: false, error: 'Customer name is required.' }

      const db = getDb()
      if (input.id) {
        if (!canEditCustomers(user.role)) {
          return { ok: false, error: 'You can add customers but not edit existing records.' }
        }
        db.prepare(
          `UPDATE customers SET name = ?, phone = ?, address = ?, notes = ?
           WHERE id = ? AND branch_id = ?`
        ).run(
          name,
          input.phone?.trim() ?? '',
          input.address?.trim() ?? '',
          input.notes?.trim() ?? '',
          input.id,
          user.branchId
        )
        writeAudit(user.id, 'edit', 'customer', input.id, { name })
      } else {
        const opening = Number.isInteger(input.openingBalanceKobo) ? (input.openingBalanceKobo ?? 0) : 0
        if (!canEditCustomers(user.role) && opening !== 0) {
          return { ok: false, error: 'Only a manager or admin can set an opening balance.' }
        }
        const result = db
          .prepare(
            `INSERT INTO customers (
               branch_id, name, phone, address, notes, opening_balance, current_balance
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            user.branchId,
            name,
            input.phone?.trim() ?? '',
            input.address?.trim() ?? '',
            input.notes?.trim() ?? '',
            opening,
            opening
          )
        input.id = Number(result.lastInsertRowid)
        writeAudit(user.id, 'create', 'customer', input.id, { name, opening })
      }

      const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(input.id) as CustomerRow
      return { ok: true, data: mapCustomer(row) }
    }
  )

  ipcMain.handle(
    'customers:history',
    (
      _event,
      customerId: number
    ): Result<{ customer: CustomerRecord; receipts: ReceiptSummary[]; payments: PaymentRecord[] }> => {
      return loadCustomerHistory(customerId)
    }
  )
}

export function loadCustomerHistory(
  customerId: number
): Result<{ customer: CustomerRecord; receipts: ReceiptSummary[]; payments: PaymentRecord[] }> {
      const user = requireSession()
      const row = getDb()
        .prepare('SELECT * FROM customers WHERE id = ? AND branch_id = ?')
        .get(customerId, user.branchId) as CustomerRow | undefined
      if (!row) return { ok: false, error: 'Customer was not found.' }

      const receipts = getDb()
        .prepare(
          `SELECT r.*, c.name AS customer_name, u.username AS cashier_name
           FROM receipts r
           LEFT JOIN customers c ON c.id = r.customer_id
           JOIN users u ON u.id = r.cashier_id
           WHERE r.customer_id = ? AND r.branch_id = ?
           ORDER BY r.id DESC`
        )
        .all(customerId, user.branchId) as Array<{
        id: number
        receipt_number: string
        customer_id: number | null
        cashier_id: number
        receipt_date: string
        total: number
        amount_paid: number
        payment_method: PaymentRecord['method']
        status: 'active' | 'voided'
        balance_after: number
        customer_name: string | null
        cashier_name: string
      }>

      const payments = getDb()
        .prepare(
          `SELECT p.*, c.name AS customer_name, u.username AS recorded_by_name, r.receipt_number,
                  CASE WHEN r.status = 'voided' THEN 1 ELSE 0 END AS voided_receipt
           FROM payments p
           JOIN customers c ON c.id = p.customer_id
           JOIN users u ON u.id = p.recorded_by
           LEFT JOIN receipts r ON r.id = p.receipt_id
           WHERE p.customer_id = ? AND p.branch_id = ?
           ORDER BY p.id DESC`
        )
        .all(customerId, user.branchId) as Array<{
        id: number
        customer_id: number
        customer_name: string
        receipt_id: number | null
        receipt_number: string | null
        amount: number
        method: PaymentRecord['method']
        payment_date: string
        recorded_by_name: string
        notes: string
        voided_receipt: number
      }>

      return {
        ok: true,
        data: {
          customer: mapCustomer(row),
          receipts: receipts.map((r) => ({
            id: r.id,
            receiptNumber: r.receipt_number,
            customerId: r.customer_id,
            customerName: r.customer_name ?? 'Walk-in / Cash customer',
            cashierId: r.cashier_id,
            cashierName: r.cashier_name,
            receiptDate: r.receipt_date,
            totalKobo: r.total,
            amountPaidKobo: r.amount_paid,
            paymentMethod: r.payment_method,
            status: r.status,
            balanceAfterKobo: r.balance_after
          })),
          payments: payments.map((p) => ({
            id: p.id,
            customerId: p.customer_id,
            customerName: p.customer_name,
            receiptId: p.receipt_id,
            receiptNumber: p.receipt_number,
            amountKobo: p.amount,
            method: p.method,
            paymentDate: p.payment_date,
            recordedByName: p.recorded_by_name,
            notes: p.notes,
            voidedReceipt: p.voided_receipt === 1
          }))
        }
      }
}
