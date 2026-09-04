export type UserRole = 'admin' | 'manager' | 'cashier'

export type ScreenKey =
  | 'dashboard'
  | 'new_receipt'
  | 'receipt_preview'
  | 'receipt_history'
  | 'products'
  | 'customers'
  | 'payments'
  | 'reports'
  | 'settings'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'pos' | 'opay' | 'other'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SessionUser {
  id: number
  branchId: number
  username: string
  fullName: string
  role: UserRole
  mustChangePassword: boolean
}

export interface BranchInfo {
  id: number
  name: string
  address: string
  phone: string
  email: string
  receiptPrefix: string
}

export interface ReceiptCounterInfo {
  prefix: string
  nextNumber: number
}

export interface AppSettings {
  printerWidth: '58mm' | '80mm'
  printerName: string
  taxEnabled: boolean
  taxPercent: string
  discountEnabled: boolean
  idleLogoutMinutes: number
  stockTrackingEnabled: boolean
  backupReminderDays: number
  debtAlertKobo: number
  lastBackupAt: string
}

export interface AppContext {
  user: SessionUser
  branch: BranchInfo
  counter: ReceiptCounterInfo
  settings: AppSettings
  dbPath: string
}

export type LoginResult =
  | { ok: true; user: SessionUser; branch: BranchInfo }
  | { ok: false; error: string }

export type ChangePasswordResult = { ok: true } | { ok: false; error: string }

export interface ProductRecord {
  id: number
  name: string
  category: string
  unit: string
  unitPriceKobo: number
  trackStock: boolean
  stockQty: number | null
  active: boolean
}

export interface CustomerRecord {
  id: number
  name: string
  phone: string
  address: string
  notes: string
  openingBalanceKobo: number
  currentBalanceKobo: number
  createdAt: string
}

export interface ReceiptItemInput {
  productId: number | null
  description: string
  qty: number
  unitPriceKobo: number
}

export interface SaveReceiptInput {
  customerId: number | null
  paymentMethod: PaymentMethod
  amountPaidKobo: number
  discountKobo: number
  notes: string
  items: ReceiptItemInput[]
}

export interface ReceiptItemRecord {
  id: number
  productId: number | null
  description: string
  qty: number
  unitPriceKobo: number
  lineTotalKobo: number
}

export interface ReceiptSummary {
  id: number
  receiptNumber: string
  customerId: number | null
  customerName: string
  cashierId: number
  cashierName: string
  receiptDate: string
  totalKobo: number
  amountPaidKobo: number
  paymentMethod: PaymentMethod
  status: 'active' | 'voided'
  balanceAfterKobo: number
}

export interface ReceiptDetail extends ReceiptSummary {
  branch: BranchInfo
  subtotalKobo: number
  taxKobo: number
  discountKobo: number
  balanceBeforeKobo: number
  notes: string
  items: ReceiptItemRecord[]
}

export interface PaymentRecord {
  id: number
  customerId: number
  customerName: string
  receiptId: number | null
  receiptNumber: string | null
  amountKobo: number
  method: PaymentMethod
  paymentDate: string
  recordedByName: string
  notes: string
  voidedReceipt: boolean
}

export interface DashboardData {
  todaySalesKobo: number
  todayReceiptCount: number
  outstandingTotalKobo: number
  outstandingCount: number
  highDebt: Array<{ id: number; name: string; balanceKobo: number }>
  lowStock: Array<{ id: number; name: string; stockQty: number }>
  nextReceiptNumber: string
  branch: BranchInfo
  settings: AppSettings
  backupOverdue: boolean
}

export interface SalesReportRow {
  date: string
  cashierName: string
  receiptCount: number
  totalKobo: number
  paidKobo: number
}

export interface ProductSalesRow {
  description: string
  qty: number
  totalKobo: number
}

export interface PaymentBreakdownRow {
  method: PaymentMethod
  count: number
  totalKobo: number
}

export interface ReportsData {
  fromDate: string
  toDate: string
  sales: SalesReportRow[]
  salesTotalKobo: number
  outstanding: Array<{ id: number; name: string; phone: string; balanceKobo: number }>
  productSales: ProductSalesRow[]
  payments: PaymentBreakdownRow[]
}

export interface StaffUser {
  id: number
  username: string
  fullName: string
  role: UserRole
  active: boolean
  mustChangePassword: boolean
}

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export interface AuditRow {
  id: number
  action: string
  entity: string
  entity_id: number | null
  details: string
  timestamp: string
  username: string | null
}

export interface SettingsPayload {
  settings: AppSettings
  branch: BranchInfo
  counter: ReceiptCounterInfo
  dbPath: string
}
