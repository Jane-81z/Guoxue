import { describe, expect, it } from 'vitest'
import { buildDailyReminderIcs } from './ics'

describe('buildDailyReminderIcs', () => {
  const ics = buildDailyReminderIcs({
    time: '20:30',
    startDate: '2026-09-17',
    now: new Date('2026-09-17T00:00:00Z'),
  })

  it('是合法的 VCALENDAR 结构', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('每天重复并带提醒', () => {
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('TRIGGER:PT0M')
    expect(ics).toContain('ACTION:DISPLAY')
  })

  it('使用浮动本地时间（不带 Z 与时区）', () => {
    expect(ics).toContain('DTSTART:20260917T203000')
    expect(ics).toContain('DTEND:20260917T204500')
  })

  it('每行不超过 75 字节（折行合规）', () => {
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('非法时间回退到 20:00', () => {
    const fallback = buildDailyReminderIcs({ time: 'abc', startDate: '2026-09-17' })
    expect(fallback).toContain('DTSTART:20260917T200000')
  })

  it('跨月与跨日时结束时间仍按真实日期计算', () => {
    const monthEnd = buildDailyReminderIcs({
      time: '23:50',
      startDate: '2026-09-30',
      durationMinutes: 20,
    })
    expect(monthEnd).toContain('DTSTART:20260930T235000')
    expect(monthEnd).toContain('DTEND:20261001T001000')
  })
})
