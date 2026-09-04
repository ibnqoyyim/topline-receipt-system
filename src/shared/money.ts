/**
 * Integer kobo arithmetic. 1 Naira = 100 kobo. Never use floating point for money.
 */
export function nairaToKobo(input: string): number {
  const cleaned = input.replace(/,/g, '').trim()
  if (!cleaned) return 0
  const negative = cleaned.startsWith('-')
  const unsigned = negative ? cleaned.slice(1) : cleaned
  const match = unsigned.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) {
    throw new Error('Enter a valid amount (e.g. 72000 or 72,000.00).')
  }
  const whole = Number.parseInt(match[1] ?? '0', 10)
  const frac = Number.parseInt((match[2] ?? '').padEnd(2, '0') || '0', 10)
  const kobo = whole * 100 + frac
  return negative ? -kobo : kobo
}

export function tryNairaToKobo(input: string): { ok: true; kobo: number } | { ok: false; error: string } {
  try {
    return { ok: true, kobo: nairaToKobo(input) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid amount' }
  }
}

export function koboToNairaPlain(kobo: number): string {
  const sign = kobo < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(kobo))
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${whole}.${frac}`
}

export function koboToNairaGrouped(kobo: number): string {
  const sign = kobo < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(kobo))
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${whole.toLocaleString('en-NG')}.${frac}`
}

export function formatNaira(kobo: number): string {
  return `₦${koboToNairaGrouped(kobo)}`
}

/** Outstanding owed *to* Topline is shown with a leading minus (SRS Section 9). */
export function formatOutstanding(debtKobo: number): string {
  if (debtKobo === 0) return '₦0.00'
  if (debtKobo > 0) return `-₦${koboToNairaGrouped(debtKobo)}`
  return `₦${koboToNairaGrouped(-debtKobo)} CR`
}

export function percentOfKobo(amountKobo: number, percentStr: string): number {
  const hundredths = nairaToKobo(percentStr || '0')
  return Math.round((amountKobo * hundredths) / 10000)
}
