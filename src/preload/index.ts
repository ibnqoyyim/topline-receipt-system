import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AdjustReceiptInput,
  AppContext,
  AuditRow,
  ChangePasswordResult,
  CustomerRecord,
  DashboardData,
  LoginResult,
  PaymentMethod,
  PaymentRecord,
  PrinterInfo,
  ProductRecord,
  ReceiptDetail,
  ReceiptSummary,
  ReportsData,
  Result,
  SaveReceiptInput,
  SessionUser,
  SettingsPayload,
  StaffUser
} from '../shared/types'

const api = {
  login: (username: string, password: string): Promise<LoginResult> =>
    ipcRenderer.invoke('auth:login', { username, password }),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
  getSession: (): Promise<SessionUser | null> => ipcRenderer.invoke('auth:session'),
  changePassword: (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> =>
    ipcRenderer.invoke('auth:changePassword', { currentPassword, newPassword }),
  forgotPassword: (
    username: string,
    shopPhone: string,
    newPassword: string
  ): Promise<ChangePasswordResult> =>
    ipcRenderer.invoke('auth:forgotPassword', { username, shopPhone, newPassword }),
  getAppContext: (): Promise<AppContext> => ipcRenderer.invoke('app:context'),
  factoryResetApp: (password: string, confirm: string): Promise<Result<string>> =>
    ipcRenderer.invoke('app:factoryReset', { password, confirm }),

  getDashboard: (): Promise<DashboardData> => ipcRenderer.invoke('dashboard:data'),

  listProducts: (includeInactive = false): Promise<ProductRecord[]> =>
    ipcRenderer.invoke('products:list', includeInactive),
  saveProduct: (input: {
    id?: number
    name: string
    category: string
    unit: string
    unitPriceKobo: number
    trackStock: boolean
    stockQty: number | null
    active: boolean
  }): Promise<Result<ProductRecord>> => ipcRenderer.invoke('products:save', input),
  deactivateProduct: (id: number): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('products:deactivate', id),

  listCustomers: (filters?: {
    query?: string
    balance?: 'all' | 'owing' | 'settled'
  }): Promise<CustomerRecord[]> => ipcRenderer.invoke('customers:list', filters),
  getCustomer: (id: number): Promise<Result<CustomerRecord>> => ipcRenderer.invoke('customers:get', id),
  saveCustomer: (input: {
    id?: number
    name: string
    phone: string
    address: string
    notes: string
    openingBalanceKobo?: number
  }): Promise<Result<CustomerRecord>> => ipcRenderer.invoke('customers:save', input),
  getCustomerHistory: (
    id: number
  ): Promise<Result<{ customer: CustomerRecord; receipts: ReceiptSummary[]; payments: PaymentRecord[] }>> =>
    ipcRenderer.invoke('customers:history', id),
  printCustomerStatement: (id: number): Promise<Result<true>> =>
    ipcRenderer.invoke('customers:printStatement', id),
  exportCustomerStatementPdf: (id: number): Promise<Result<string>> =>
    ipcRenderer.invoke('customers:statementPdf', id),

  saveReceipt: (input: SaveReceiptInput): Promise<Result<ReceiptDetail>> =>
    ipcRenderer.invoke('receipts:save', input),
  adjustReceipt: (id: number, input: AdjustReceiptInput): Promise<Result<ReceiptDetail>> =>
    ipcRenderer.invoke('receipts:adjust', { id, ...input }),
  getReceipt: (id: number): Promise<Result<ReceiptDetail>> => ipcRenderer.invoke('receipts:get', id),
  listReceipts: (filters?: {
    query?: string
    fromDate?: string
    toDate?: string
    cashierId?: number | null
    status?: 'active' | 'voided' | 'all'
  }): Promise<ReceiptSummary[]> => ipcRenderer.invoke('receipts:list', filters),
  voidReceipt: (id: number): Promise<Result<ReceiptDetail>> => ipcRenderer.invoke('receipts:void', id),
  printReceipt: (id: number): Promise<Result<true>> => ipcRenderer.invoke('receipts:print', id),
  exportReceiptPdf: (id: number): Promise<Result<string>> => ipcRenderer.invoke('receipts:pdf', id),
  printTestPage: (): Promise<Result<true>> => ipcRenderer.invoke('receipts:printTest'),

  listPayments: (filters?: { query?: string; fromDate?: string; toDate?: string }): Promise<PaymentRecord[]> =>
    ipcRenderer.invoke('payments:list', filters),
  recordPayment: (input: {
    customerId: number
    amountKobo: number
    method: PaymentMethod
    notes: string
  }): Promise<Result<PaymentRecord>> => ipcRenderer.invoke('payments:record', input),

  getReports: (range: { fromDate: string; toDate: string }): Promise<ReportsData> =>
    ipcRenderer.invoke('reports:get', range),
  exportReportsPdf: (range: { fromDate: string; toDate: string }): Promise<Result<string>> =>
    ipcRenderer.invoke('reports:pdf', range),
  printReports: (range: { fromDate: string; toDate: string }): Promise<Result<true>> =>
    ipcRenderer.invoke('reports:print', range),

  getSettings: (): Promise<SettingsPayload> => ipcRenderer.invoke('settings:get'),
  saveSettings: (input: {
    branch: { name: string; address: string; phone: string; email: string; receiptPrefix: string }
    nextNumber: number
    settings: {
      printerWidth: '58mm' | '80mm'
      printerName: string
      taxEnabled: boolean
      taxPercent: string
      discountEnabled: boolean
      idleLogoutMinutes: number
      stockTrackingEnabled: boolean
      backupReminderDays: number
      debtAlertKobo: number
      openAtLogin: boolean
    }
  }): Promise<Result<SettingsPayload['settings']>> => ipcRenderer.invoke('settings:save', input),
  listUsers: (): Promise<StaffUser[]> => ipcRenderer.invoke('settings:users'),
  saveUser: (input: {
    id?: number
    username: string
    fullName: string
    role: SessionUser['role']
    password?: string
    active: boolean
    mustChangePassword: boolean
  }): Promise<Result<StaffUser>> => ipcRenderer.invoke('settings:saveUser', input),
  backupDatabase: (): Promise<Result<string>> => ipcRenderer.invoke('settings:backup'),
  restoreDatabase: (): Promise<Result<string>> => ipcRenderer.invoke('settings:restore'),
  listPrinters: (): Promise<PrinterInfo[]> => ipcRenderer.invoke('printers:list'),
  listAudit: (): Promise<AuditRow[]> => ipcRenderer.invoke('audit:list')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore contextIsolation disabled fallback
  window.electron = electronAPI
  // @ts-ignore contextIsolation disabled fallback
  window.api = api
}

export type ToplineApi = typeof api
