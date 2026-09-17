const DAY_MS = 24 * 60 * 60 * 1000

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 本地日期 -> YYYY-MM-DD */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天（本地时区） */
export function todayKey(): string {
  return toDateKey(new Date())
}

/** YYYY-MM-DD -> 本地零点的 Date */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((v) => Number.parseInt(v, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const d = parseDateKey(key)
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** a 比 b 晚多少天（a - b） */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDateKey(a).getTime() - parseDateKey(b).getTime()) / DAY_MS)
}

export function formatCn(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatCnFull(key: string): string {
  const d = parseDateKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayCn(key: string): string {
  return `周${WEEKDAYS[parseDateKey(key).getDay()]}`
}

/** 相对今天的自然语言描述 */
export function relativeDay(key: string, today = todayKey()): string {
  const d = diffDays(key, today)
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  if (d === 2) return '后天'
  if (d === -1) return '昨天'
  if (d < 0) return `逾期 ${Math.abs(d)} 天`
  if (d < 30) return `${d} 天后`
  if (d < 365) return `约 ${Math.round(d / 30)} 个月后`
  return `约 ${(d / 365).toFixed(1)} 年后`
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}
