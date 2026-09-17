import { useMemo } from 'react'
import type { DailyStat } from '../types'
import { addDays, parseDateKey, todayKey } from '../lib/date'

interface HeatmapProps {
  dailyStats: DailyStat[]
  /** 展示最近多少周 */
  weeks?: number
}

const LEVEL_CLASS = [
  'bg-paper-deep',
  'bg-jade/25',
  'bg-jade/45',
  'bg-jade/70',
  'bg-jade',
]

function levelOf(count: number): number {
  if (count <= 0) return 0
  if (count < 5) return 1
  if (count < 10) return 2
  if (count < 20) return 3
  return 4
}

function endOfWeek(key: string): string {
  const day = parseDateKey(key).getDay()
  return addDays(key, 6 - day)
}

export default function Heatmap({ dailyStats, weeks = 26 }: HeatmapProps) {
  const { columns, monthLabels, total } = useMemo(() => {
    const statsByDate = new Map(dailyStats.map((s) => [s.date, s]))
    const today = todayKey()
    const lastDay = endOfWeek(today)
    const cells: { date: string; count: number; checkedIn: boolean; future: boolean }[][] = []
    const labels: { index: number; text: string }[] = []
    let sum = 0

    for (let w = weeks - 1; w >= 0; w -= 1) {
      const weekStart = addDays(lastDay, -7 * w - 6)
      const column: (typeof cells)[number] = []
      for (let d = 0; d < 7; d += 1) {
        const date = addDays(weekStart, d)
        const stat = statsByDate.get(date)
        const count = stat?.reviewedCount ?? 0
        sum += count
        column.push({ date, count, checkedIn: stat?.checkedIn ?? false, future: date > today })
      }
      const month = parseDateKey(column[0].date).getMonth() + 1
      const prevMonth = cells.length
        ? parseDateKey(cells[cells.length - 1][0].date).getMonth() + 1
        : null
      if (prevMonth !== null && month !== prevMonth) {
        labels.push({ index: cells.length, text: `${month}月` })
      }
      cells.push(column)
    }
    return { columns: cells, monthLabels: labels, total: sum }
  }, [dailyStats, weeks])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="meta">最近 {weeks} 周共复习 {total} 张</span>
        <div className="flex items-center gap-1">
          <span className="meta">少</span>
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={`h-2.5 w-2.5 rounded-[1px] ${cls}`} />
          ))}
          <span className="meta">多</span>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-none">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] pl-1">
            {columns.map((_, index) => {
              const label = monthLabels.find((m) => m.index === index)
              return (
                <span key={index} className="w-3.5 text-[10px] leading-3 text-ink-faint">
                  {label?.text ?? ''}
                </span>
              )
            })}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((column, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}　复习 ${cell.count} 张${cell.checkedIn ? '　已打卡' : ''}`}
                    className={`h-3.5 w-3.5 rounded-[1px] ${
                      cell.future ? 'bg-transparent' : LEVEL_CLASS[levelOf(cell.count)]
                    } ${cell.checkedIn ? 'ring-1 ring-cinnabar/55' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
