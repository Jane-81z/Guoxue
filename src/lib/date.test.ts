import { describe, expect, it } from 'vitest'
import { addDays, diffDays, isValidDateKey, relativeDay, toDateKey, weekdayCn } from './date'

describe('date 工具', () => {
  it('本地日期格式化', () => {
    expect(toDateKey(new Date(2026, 8, 17))).toBe('2026-09-17')
  })

  it('跨月加天数', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('闰年加天数', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('日期间隔', () => {
    expect(diffDays('2026-09-17', '2026-09-10')).toBe(7)
    expect(diffDays('2026-09-10', '2026-09-17')).toBe(-7)
  })

  it('日期合法性', () => {
    expect(isValidDateKey('2026-09-17')).toBe(true)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-9-17')).toBe(false)
  })

  it('相对日期描述', () => {
    expect(relativeDay('2026-09-17', '2026-09-17')).toBe('今天')
    expect(relativeDay('2026-09-18', '2026-09-17')).toBe('明天')
    expect(relativeDay('2026-09-14', '2026-09-17')).toBe('逾期 3 天')
  })

  it('星期', () => {
    expect(weekdayCn('2026-09-17')).toBe('周四')
  })
})
