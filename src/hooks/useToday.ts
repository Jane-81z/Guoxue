import { useEffect, useState } from 'react'
import { todayKey } from '../lib/date'

/** 当前本地日期，跨零点与回到前台时自动刷新 */
export function useToday(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    const sync = () => setToday((prev) => {
      const next = todayKey()
      return prev === next ? prev : next
    })
    const timer = window.setInterval(sync, 60 * 1000)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return today
}
