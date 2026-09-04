import { ipcMain } from 'electron'
import { getDb } from '../db'
import { formatReceiptNumber, todayIsoDate } from '../../shared/format'
import { canViewAllReports } from '../../shared/permissions'
import type { DashboardData, PaymentMethod, ReportsData } from '../../shared/types'
import { getBranch, readCounter, readSettings, requireSession } from './session'

export function registerReportHandlers(): void {
  ipcMain.handle('dashboard:data', (): DashboardData => {
    const user = requireSession()
    const db = getDb()
    const settings = readSettings()
    const today = todayIsoDate()
    const counter = readCounter(user.branchId)

    const sales = db
      .prepare(
        `SELECT IFNULL(SUM(total), 0) AS total, COUNT(*) AS count
         FROM receipts
         WHERE branch_id = ? AND status = 'active' AND substr(receipt_date, 1, 10) = ?`
      )
      .get(user.branchId, today) as { total: number; count: number }

    const outstanding = db
      .prepare(
        `SELECT IFNULL(SUM(current_balance), 0) AS total, COUNT(*) AS count
         FROM customers WHERE branch_id = ? AND current_balance > 0`
      )
      .get(user.branchId) as { total: number; count: number }

    const highDebt = db
      .prepare(
        `SELECT id, name, current_balance FROM customers
         WHERE branch_id = ? AND current_balance >= ?
         ORDER BY current_balance DESC LIMIT 10`
      )
      .all(user.branchId, settings.debtAlertKobo) as Array<{
      id: number
      name: string
      current_balance: number
    }>

    const lowStock = settings.stockTrackingEnabled
      ? (db
          .prepare(
            `SELECT id, name, stock_qty FROM products
             WHERE branch_id = ? AND active = 1 AND track_stock = 1 AND stock_qty IS NOT NULL AND stock_qty <= 5
             ORDER BY stock_qty ASC LIMIT 10`
          )
          .all(user.branchId) as Array<{ id: number; name: string; stock_qty: number }>)
      : []

    let backupOverdue = false
    if (settings.backupReminderDays > 0) {
      if (!settings.lastBackupAt) {
        backupOverdue = true
      } else {
        const last = Date.parse(settings.lastBackupAt)
        const days = (Date.now() - last) / 86_400_000
        backupOverdue = days >= settings.backupReminderDays
      }
    }

    return {
      todaySalesKobo: sales.total,
      todayReceiptCount: sales.count,
      outstandingTotalKobo: outstanding.total,
      outstandingCount: outstanding.count,
      highDebt: highDebt.map((row) => ({ id: row.id, name: row.name, balanceKobo: row.current_balance })),
      lowStock: lowStock.map((row) => ({ id: row.id, name: row.name, stockQty: row.stock_qty })),
      nextReceiptNumber: formatReceiptNumber(counter.prefix, counter.nextNumber),
      branch: getBranch(user.branchId),
      settings,
      backupOverdue
    }
  })

  ipcMain.handle(
    'reports:get',
    (_event, range: { fromDate: string; toDate: string }): ReportsData => {
      const user = requireSession()
      const fromDate = range.fromDate || todayIsoDate()
      const toDate = range.toDate || todayIsoDate()
      const db = getDb()

      const cashierFilter = canViewAllReports(user.role) ? '' : ' AND r.cashier_id = ?'
      const cashierParams = canViewAllReports(user.role) ? [] : [user.id]

      const sales = db
        .prepare(
          `SELECT substr(r.receipt_date, 1, 10) AS day, u.username AS cashier_name,
                  COUNT(*) AS receipt_count, SUM(r.total) AS total, SUM(r.amount_paid) AS paid
           FROM receipts r
           JOIN users u ON u.id = r.cashier_id
           WHERE r.branch_id = ? AND r.status = 'active'
             AND substr(r.receipt_date, 1, 10) >= ? AND substr(r.receipt_date, 1, 10) <= ?
             ${cashierFilter}
           GROUP BY day, u.username
           ORDER BY day, u.username`
        )
        .all(user.branchId, fromDate, toDate, ...cashierParams) as Array<{
        day: string
        cashier_name: string
        receipt_count: number
        total: number
        paid: number
      }>

      const outstanding = db
        .prepare(
          `SELECT id, name, phone, current_balance FROM customers
           WHERE branch_id = ? AND current_balance > 0
           ORDER BY current_balance DESC`
        )
        .all(user.branchId) as Array<{ id: number; name: string; phone: string; current_balance: number }>

      const productSales = db
        .prepare(
          `SELECT i.description, SUM(i.qty) AS qty, SUM(i.line_total) AS total
           FROM receipt_items i
           JOIN receipts r ON r.id = i.receipt_id
           WHERE r.branch_id = ? AND r.status = 'active'
             AND substr(r.receipt_date, 1, 10) >= ? AND substr(r.receipt_date, 1, 10) <= ?
             ${cashierFilter}
           GROUP BY i.description
           ORDER BY total DESC
           LIMIT 50`
        )
        .all(user.branchId, fromDate, toDate, ...cashierParams) as Array<{
        description: string
        qty: number
        total: number
      }>

      const payments = db
        .prepare(
          `SELECT p.method, COUNT(*) AS count, SUM(p.amount) AS total
           FROM payments p
           LEFT JOIN receipts r ON r.id = p.receipt_id
           WHERE p.branch_id = ?
             AND substr(p.payment_date, 1, 10) >= ? AND substr(p.payment_date, 1, 10) <= ?
             AND (p.receipt_id IS NULL OR r.status = 'active')
           GROUP BY p.method
           ORDER BY total DESC`
        )
        .all(user.branchId, fromDate, toDate) as Array<{
        method: PaymentMethod
        count: number
        total: number
      }>

      const salesTotalKobo = sales.reduce((sum, row) => sum + row.total, 0)

      return {
        fromDate,
        toDate,
        sales: sales.map((row) => ({
          date: row.day,
          cashierName: row.cashier_name,
          receiptCount: row.receipt_count,
          totalKobo: row.total,
          paidKobo: row.paid
        })),
        salesTotalKobo,
        outstanding: outstanding.map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          balanceKobo: row.current_balance
        })),
        productSales: productSales.map((row) => ({
          description: row.description,
          qty: row.qty,
          totalKobo: row.total
        })),
        payments: payments.map((row) => ({
          method: row.method,
          count: row.count,
          totalKobo: row.total
        }))
      }
    }
  )
}
