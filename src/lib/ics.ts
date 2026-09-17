/**
 * 生成「每天固定时间提醒背书」的日历文件（浮动本地时间，不含时区）。
 * 导入 iPhone 日历后长期有效，重复导入会按 UID 覆盖同一条日程。
 */
export interface IcsOptions {
  /** HH:mm */
  time: string
  title?: string
  description?: string
  durationMinutes?: number
  /** 从哪一天开始，默认今天 */
  startDate?: string
  now?: Date
}

const ICS_UID = 'guoxue-recitation-daily-reminder@local'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** 浮动本地时间：YYYYMMDDTHHmmss，不带时区 */
function toFloatingLocalStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** 按 75 字节折行，符合 RFC 5545 */
function fold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 73) return line
  const chunks: string[] = []
  let current = ''
  for (const char of line) {
    if (encoder.encode(current + char).length > 73) {
      chunks.push(current)
      current = char
    } else {
      current += char
    }
  }
  chunks.push(current)
  return chunks.join('\r\n ')
}

export function buildDailyReminderIcs(options: IcsOptions): string {
  const time = /^\d{2}:\d{2}$/.test(options.time) ? options.time : '20:00'
  const [hour, minute] = time.split(':').map((v) => Number.parseInt(v, 10))
  const start = options.startDate ? new Date(`${options.startDate}T00:00:00`) : new Date()
  const duration = options.durationMinutes ?? 15
  const title = options.title ?? '今日背书'
  const description =
    options.description ?? '打开「国学背诵」，完成今日到期的复习卡片。'

  const startAt = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    hour,
    minute,
    0,
  )
  const endAt = new Date(startAt.getTime() + duration * 60 * 1000)
  const dtStart = toFloatingLocalStamp(startAt)
  const dtEnd = toFloatingLocalStamp(endAt)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Guoxue Recitation//Daily Reminder//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ICS_UID}`,
    `DTSTAMP:${toUtcStamp(options.now ?? new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    'RRULE:FREQ=DAILY',
    fold(`SUMMARY:${escapeText(title)}`),
    fold(`DESCRIPTION:${escapeText(description)}`),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:${escapeText(title)}`),
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
  return lines.join('\r\n')
}
