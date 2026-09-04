import { ipcMain } from 'electron'
import { getDb } from '../db'
import { nowLocalIso } from '../../shared/format'
import type { PaymentMethod, PaymentRecord, Result } from '../../shared/types'
import { requireSession, writeAudit } from './session'

export function registerPaymentHandlers(): void {
  ipcMain.handle(
    'payments:list',
    (_event, filters?: { query?: string; fromDate?: string; toDate?: string }): PaymentRecord[] => {
      const user = requireSession()
      const clauses = ['p.branch_id = ?']
      const params: Array<string | number> = [user.branchId]
      if (filters?.query?.trim()) {
        clauses.push('(c.name LIKE ? OR IFNULL(r.receipt_number, "") LIKE ?)')
        const like = `%${filters.query.trim()}%`
        params.push(like, like)
      }
      if (filters?.fromDate) {
        clauses.push('substr(p.payment_date, 1, 10) >= ?')
        params.push(filters.fromDate)
      }
      if (filters?.toDate) {
        clauses.push('substr(p.payment_date, 1, 10) <= ?')
        params.push(filters.toDate)
      }

      const rows = getDb()
        .prepare(
          `SELECT p.*, c.name AS customer_name, u.username AS recorded_by_name, r.receipt_number,
                  CASE WHEN r.status = 'voided' THEN 1 ELSE 0 END AS voided_receipt
           FROM payments p
           JOIN customers c ON c.id = p.customer_id
           JOIN users u ON u.id = p.recorded_by
           LEFT JOIN receipts r ON r.id = p.receipt_id
           WHERE ${clauses.join(' AND ')}
           ORDER BY p.id DESC
           LIMIT 500`
        )
        .all(...params) as Array<{
        id: number
        customer_id: number
        customer_name: string
        receipt_id: number | null
        receipt_number: string | null
        amount: number
        method: PaymentMethod
        payment_date: string
        recorded_by_name: string
        notes: string
        voided_receipt: number
      }>

      return rows.map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        receiptId: row.receipt_id,
        receiptNumber: row.receipt_number,
        amountKobo: row.amount,
        method: row.method,
        paymentDate: row.payment_date,
        recordedByName: row.recorded_by_name,
        notes: row.notes,
        voidedReceipt: row.voided_receipt === 1
      }))
    }
  )

  ipcMain.handle(
    'payments:record',
    (
      _event,
      input: {
        customerId: number
        amountKobo: number
        method: PaymentMethod
        notes: string
      }
    ): Result<PaymentRecord> => {
      const user = requireSession()
      if (!input.customerId) return { ok: false, error: 'Select a customer.' }
      if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
        return { ok: false, error: 'Payment amount must be greater than zero.' }
      }

      const db = getDb()
      try {
        const paymentId = db.transaction(() => {
          const customer = db
            .prepare('SELECT id, current_balance FROM customers WHERE id = ? AND branch_id = ?')
            .get(input.customerId, user.branchId) as { id: number; current_balance: number } | undefined
          if (!customer) throw new Error('Customer was not found.')

          const paymentDate = nowLocalIso()
          const result = db
            .prepare(
              `INSERT INTO payments (
                 branch_id, customer_id, receipt_id, amount, method, payment_date, recorded_by, notes
               ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
            )
            .run(
              user.branchId,
              input.customerId,
              input.amountKobo,
              input.method,
              paymentDate,
              user.id,
              input.notes?.trim() ?? ''
            )

          db.prepare(
            'UPDATE customers SET current_balance = current_balance - ? WHERE id = ?'
          ).run(input.amountKobo, input.customerId)

          const id = Number(result.lastInsertRowid)
          writeAudit(user.id, 'create', 'payment', id, {
            customerId: input.customerId,
            amount: input.amountKobo
          })
          return id
        })()

        const row = db
          .prepare(
            `SELECT p.*, c.name AS customer_name, u.username AS recorded_by_name, r.receipt_number,
                    0 AS voided_receipt
             FROM payments p
             JOIN customers c ON c.id = p.customer_id
             JOIN users u ON u.id = p.recorded_by
             LEFT JOIN receipts r ON r.id = p.receipt_id
             WHERE p.id = ?`
          )
          .get(paymentId) as {
          id: number
          customer_id: number
          customer_name: string
          receipt_id: number | null
          receipt_number: string | null
          amount: number
          method: PaymentMethod
          payment_date: string
          recorded_by_name: string
          notes: string
          voided_receipt: number
        }

        return {
          ok: true,
          data: {
            id: row.id,
            customerId: row.customer_id,
            customerName: row.customer_name,
            receiptId: row.receipt_id,
            receiptNumber: row.receipt_number,
            amountKobo: row.amount,
            method: row.method,
            paymentDate: row.payment_date,
            recordedByName: row.recorded_by_name,
            notes: row.notes,
            voidedReceipt: false
          }
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not record payment.' }
      }
    }
  )
}
