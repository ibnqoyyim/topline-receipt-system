import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import type { Result } from '../../shared/types'
import { loadReceipt } from '../ipc/receipts'
import { getCurrentSession, readSettings } from '../ipc/session'
import { buildReceiptHtml } from './receiptHtml'

function pageSizeMicrons(width: '58mm' | '80mm'): { width: number; height: number } {
  return {
    width: width === '58mm' ? 58000 : 80000,
    height: 400000
  }
}

async function renderReceiptWindow(receiptId: number): Promise<{
  win: BrowserWindow
  width: '58mm' | '80mm'
}> {
  const session = getCurrentSession()
  if (!session) throw new Error('Not signed in')
  const receipt = loadReceipt(receiptId, session.branchId)
  if (!receipt) throw new Error('Receipt was not found.')
  const width = readSettings().printerWidth
  const html = buildReceiptHtml(receipt, width)

  const win = new BrowserWindow({
    show: false,
    width: width === '58mm' ? 280 : 360,
    height: 800,
    webPreferences: { sandbox: true, contextIsolation: true }
  })

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return { win, width }
}

export async function printReceipt(receiptId: number): Promise<Result<true>> {
  let printWin: BrowserWindow | null = null
  try {
    const { win, width } = await renderReceiptWindow(receiptId)
    printWin = win
    const printerName = readSettings().printerName
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: Boolean(printerName),
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

export async function exportReceiptPdf(receiptId: number): Promise<Result<string>> {
  let printWin: BrowserWindow | null = null
  try {
    const { win, width } = await renderReceiptWindow(receiptId)
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
