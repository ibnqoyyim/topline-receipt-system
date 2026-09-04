import type { PaymentMethod } from './types'

export function formatReceiptNumber(prefix: string, nextNumber: number): string {
  return `${prefix}${String(nextNumber).padStart(10, '0')}`
}

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'CASH' },
  { value: 'bank_transfer', label: 'BANK TRANSFER' },
  { value: 'pos', label: 'POS' },
  { value: 'opay', label: 'OPAY' },
  { value: 'other', label: 'OTHER' }
]

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method.toUpperCase()
}

/** SRS recommended 12-hour time (e.g. Sat Jul 18 2026, 4:56 PM), not the paper "16:56 PM" quirk. */
export function formatReceiptDate(isoOrSqlite: string): string {
  const date = parseDbDate(isoOrSqlite)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  const year = date.getFullYear()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${weekday} ${month} ${day} ${year}, ${time}`
}

export function parseDbDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !value.endsWith('Z')) {
    return new Date(value)
  }
  if (/^\d{4}-\d{2}-\d{2} /.test(value)) {
    return new Date(value.replace(' ', 'T'))
  }
  return new Date(value)
}

export function nowLocalIso(): string {
  const date = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function todayIsoDate(): string {
  return nowLocalIso().slice(0, 10)
}
