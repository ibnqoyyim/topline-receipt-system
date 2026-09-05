import { BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import receiptMarkPng from '../../../assets/topline_icon_print_bw.png?asset'
import type { ReceiptDetail, Result } from '../../shared/types'
import { nowLocalIso } from '../../shared/format'
import { loadCustomerHistory } from '../ipc/customers'
import { loadReceipt } from '../ipc/receipts'
import { getReportsData } from '../ipc/reports'
import { getBranch, getCurrentSession, readSettings } from '../ipc/session'
import { buildReceiptHtml } from './receiptHtml'
import { buildReportsHtml } from './reportsHtml'
import { buildStatementHtml } from './statementHtml'

function receiptMarkSrc(): string {
  return `data:image/png;base64,${readFileSync(receiptMarkPng).toString('base64')}`
}

function testReceipt(): ReceiptDetail {
  return {
    id: 0,
    receiptNumber: 'TEST-PRINT',
    customerId: null,
    customerName: 'PRINTER TEST — NOT A SALE',
    cashierId: 0,
    cashierName: 'test',
    receiptDate: nowLocalIso(),
    totalKobo: 157_500_00,
    amountPaidKobo: 157_500_00,
    paymentMethod: 'bank_transfer',
    status: 'active',
    balanceAfterKobo: 81_410_000,
    branch: {
      id: 1,
      name: 'Topline Stores (Division of Topline Realtor & Investment Ltd)',
      address: 'Beside Ajanaku Guest House, Sawmill Area, Ido-Osun, Osun State',
      phone: '07031594752, 08035827630',
      email: 'ajibadeolufunke@gmail.com',
      receiptPrefix: 'SA'
    },
    subtotalKobo: 157_500_00,
    taxKobo: 0,
    discountKobo: 0,
    balanceBeforeKobo: 81_410_000,
    notes: 'Printer alignment test. This does not save a receipt number.',
    adjusted: false,
    adjustments: [],
    items: [
      {
        id: 1,
        productId: null,
        description: 'ESSENCE (PACKETS)',
        qty: 40,
        unitPriceKobo: 180_000,
        lineTotalKobo: 7_200_000
      },
      {
        id: 2,
        productId: null,
        description: 'PET MALT (PACKETS)',
        qty: 15,
        unitPriceKobo: 570_000,
        lineTotalKobo: 8_550_000
      }
    ]
  }
}

function pageSizeMicrons(width: '58mm' | '80mm'): { width: number; height: number } {
  return {
    width: width === '58mm' ? 58000 : 80000,
    height: 400000
  }
}

async function renderReceiptWindow(
  receiptId: number,
  showWindow: boolean
): Promise<{
  win: BrowserWindow
  width: '58mm' | '80mm'
}> {
  const session = getCurrentSession()
  if (!session) throw new Error('Not signed in')
  const receipt = loadReceipt(receiptId, session.branchId)
  if (!receipt) throw new Error('Receipt was not found.')
  const width = readSettings().printerWidth
  const html = buildReceiptHtml(receipt, width, receiptMarkSrc())

  const win = new BrowserWindow({
    show: showWindow,
    width: width === '58mm' ? 320 : 400,
    height: 720,
    autoHideMenuBar: true,
    title: `Print ${receipt.receiptNumber}`,
    webPreferences: { sandbox: true, contextIsolation: true }
  })

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { win, width }
}

export async function printReceipt(receiptId: number): Promise<Result<true>> {
  let printWin: BrowserWindow | null = null
  try {
    const printerName = readSettings().printerName
    const { win, width } = await renderReceiptWindow(receiptId, true)
    printWin = win
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: false,
          deviceName: printerName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: pageSizeMicrons(width)
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Print was cancelled or failed.'))
            return
          }
          resolve()
        }
      )
    })
    return { ok: true, data: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not print.' }
  } finally {
    printWin?.close()
  }
}

export async function printTestPage(): Promise<Result<true>> {
  let printWin: BrowserWindow | null = null
  try {
    const session = getCurrentSession()
    if (!session) throw new Error('Not signed in')
    const width = readSettings().printerWidth
    const printerName = readSettings().printerName
    const html = buildReceiptHtml(testReceipt(), width, receiptMarkSrc())
    const win = new BrowserWindow({
      show: true,
      width: width === '58mm' ? 320 : 400,
      height: 720,
      autoHideMenuBar: true,
      title: 'Print test page',
      webPreferences: { sandbox: true, contextIsolation: true }
    })
    printWin = win
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: false,
          deviceName: printerName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: pageSizeMicrons(width)
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Print was cancelled or failed.'))
            return
          }
          resolve()
        }
      )
    })
    return { ok: true, data: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not print the test page.' }
  } finally {
    printWin?.close()
  }
}

export async function exportReceiptPdf(receiptId: number): Promise<Result<string>> {
  let printWin: BrowserWindow | null = null
  try {
    const { win, width } = await renderReceiptWindow(receiptId, false)
    printWin = win
    const save = await dialog.showSaveDialog({
      title: 'Export receipt PDF',
      defaultPath: `receipt-${receiptId}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (save.canceled || !save.filePath) {
      return { ok: false, error: 'Export cancelled.' }
    }
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: pageSizeMicrons(width),
      margins: { marginType: 'none' }
    })
    writeFileSync(save.filePath, data)
    return { ok: true, data: save.filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not export PDF.' }
  } finally {
    printWin?.close()
  }
}

async function openHtmlWindow(
  title: string,
  html: string,
  show: boolean
): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    show,
    width: 900,
    height: 800,
    autoHideMenuBar: true,
    title,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  return win
}

async function printHtml(title: string, html: string): Promise<Result<true>> {
  let win: BrowserWindow | null = null
  try {
    win = await openHtmlWindow(title, html, true)
    await new Promise<void>((resolve, reject) => {
      win?.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Print was cancelled or failed.'))
            return
          }
          resolve()
        }
      )
    })
    return { ok: true, data: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not print.' }
  } finally {
    win?.close()
  }
}

async function exportHtmlPdf(title: string, html: string, defaultPath: string): Promise<Result<string>> {
  let win: BrowserWindow | null = null
  try {
    win = await openHtmlWindow(title, html, false)
    const save = await dialog.showSaveDialog({
      title,
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (save.canceled || !save.filePath) {
      return { ok: false, error: 'Export cancelled.' }
    }
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' }
    })
    writeFileSync(save.filePath, data)
    return { ok: true, data: save.filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not export PDF.' }
  } finally {
    win?.close()
  }
}

export async function printCustomerStatement(customerId: number): Promise<Result<true>> {
  const session = getCurrentSession()
  if (!session) return { ok: false, error: 'Not signed in' }
  const history = loadCustomerHistory(customerId)
  if (!history.ok) return history
  const html = buildStatementHtml(
    getBranch(session.branchId),
    history.data.customer,
    history.data.receipts,
    history.data.payments
  )
  return printHtml(`Statement ${history.data.customer.name}`, html)
}

export async function exportCustomerStatementPdf(customerId: number): Promise<Result<string>> {
  const session = getCurrentSession()
  if (!session) return { ok: false, error: 'Not signed in' }
  const history = loadCustomerHistory(customerId)
  if (!history.ok) return history
  const html = buildStatementHtml(
    getBranch(session.branchId),
    history.data.customer,
    history.data.receipts,
    history.data.payments
  )
  return exportHtmlPdf(
    'Export customer statement',
    html,
    `statement-${history.data.customer.name.replace(/[^\w-]+/g, '_')}.pdf`
  )
}

export async function exportReportsPdf(range: { fromDate: string; toDate: string }): Promise<Result<string>> {
  const session = getCurrentSession()
  if (!session) return { ok: false, error: 'Not signed in' }
  const data = getReportsData(range)
  const html = buildReportsHtml(getBranch(session.branchId), data)
  return exportHtmlPdf('Export reports PDF', html, `topline-reports-${data.fromDate}-to-${data.toDate}.pdf`)
}

export async function printReports(range: { fromDate: string; toDate: string }): Promise<Result<true>> {
  const session = getCurrentSession()
  if (!session) return { ok: false, error: 'Not signed in' }
  const data = getReportsData(range)
  const html = buildReportsHtml(getBranch(session.branchId), data)
  return printHtml(`Reports ${data.fromDate} to ${data.toDate}`, html)
}
