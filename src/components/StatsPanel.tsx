import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import Heatmap from './Heatmap'
import { useAppStore } from '../store/useAppStore'
import { useToday } from '../hooks/useToday'
import { overallStats, workProgress } from '../lib/selectors'
import { MASTERED_THRESHOLD, masteryBand } from '../lib/srs'
import { formatCn } from '../lib/date'

interface StatsPanelProps {
  open: boolean
  onClose: () => void
}

function StatCell({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[var(--c-radius)] border border-paper-line bg-paper-soft px-3 py-2.5">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="mt-0.5 font-song text-2xl leading-tight text-ink tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export default function StatsPanel({ open, onClose }: StatsPanelProps) {
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const dailyStats = useAppStore((s) => s.dailyStats)
  const today = useToday()
  const navigate = useNavigate()

  const stats = useMemo(
    () => overallStats(works, passages, today, dailyStats),
    [works, passages, today, dailyStats],
  )

  const workRows = useMemo(
    () =>
      works
        .map((w) => workProgress(w, passages, today))
        .filter((w) => w.reciteCount > 0)
        .sort((a, b) => b.mastery - a.mastery),
    [works, passages, today],
  )

  const todayStat = dailyStats.find((s) => s.date === today)
  const upcoming = useMemo(() => {
    const recite = passages.filter((p) => p.isRecite && p.srs.dueAt > today)
    if (!recite.length) return null
    const nextDate = recite.reduce(
      (min, p) => (p.srs.dueAt < min ? p.srs.dueAt : min),
      recite[0].srs.dueAt,
    )
    return { date: nextDate, count: recite.filter((p) => p.srs.dueAt === nextDate).length }
  }, [passages, today])

  return (
    <Sheet open={open} onClose={onClose} title="统计面板">
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatCell label="今日待复习" value={stats.dueCount} hint={`${stats.dueWorks} 篇`} />
          <StatCell
            label="今日已完成"
            value={stats.reviewedToday}
            hint={todayStat?.checkedIn ? '已打卡' : '未打卡'}
          />
          <StatCell label="待复习总数" value={stats.dueCount} hint="含逾期" />
          <StatCell
            label={`已掌握（≥${MASTERED_THRESHOLD}分）`}
            value={stats.masteredPassages}
            hint={`要背 ${stats.recitePassages} 段`}
          />
          <StatCell label="已背篇目" value={stats.finishedWorks} hint={`开始 ${stats.startedWorks} 篇`} />
          <StatCell label="累计复习" value={stats.totalReviews} hint="次" />
        </section>

        <section className="space-y-3">
          <h3 className="font-song text-base text-ink">熟练度分布</h3>
          <div className="space-y-2">
            {[
              { key: 'mastered', label: '精熟', cls: 'bg-jade' },
              { key: 'familiar', label: '渐熟', cls: 'bg-jade-pale' },
              { key: 'learning', label: '初记', cls: 'bg-cinnabar-pale' },
              { key: 'new', label: '未开始', cls: 'bg-ink-pale' },
            ].map((row) => {
              const count = stats.bandCounts[row.key as keyof typeof stats.bandCounts]
              const percent = stats.recitePassages ? (count / stats.recitePassages) * 100 : 0
              return (
                <div key={row.key} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs text-ink-faint">{row.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[1px] bg-paper-deep">
                    <div className={`h-full rounded-[1px] ${row.cls}`} style={{ width: `${percent}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-soft">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="meta">
            平均熟练度 {stats.averageMastery} 分（要背 {stats.recitePassages} 段 / 共{' '}
            {stats.totalPassages} 段）
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="font-song text-base text-ink">复习热力图</h3>
          <Heatmap dailyStats={dailyStats} weeks={26} />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-song text-base text-ink">各篇熟练度</h3>
            {upcoming ? (
              <span className="meta">
                下次复习 {formatCn(upcoming.date)}（{upcoming.count} 段）
              </span>
            ) : null}
          </div>
          {workRows.length === 0 ? (
            <p className="meta">还没有需要背诵的篇目。</p>
          ) : (
            <ul className="space-y-2.5">
              {workRows.map((row) => (
                <li key={row.work.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      className="truncate text-left font-song text-sm text-ink underline-offset-2 hover:underline"
                      onClick={() => {
                        onClose()
                        navigate(`/library?work=${encodeURIComponent(row.work.id)}`)
                      }}
                    >
                      {row.work.title}
                    </button>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                      已背 {row.reviewedCount}/{row.reciteCount} 段
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    熟练度 {row.mastery} 分　累计复习 {row.reviewedTotal} 次
                    {row.dueCount ? `　待复习 ${row.dueCount} 段` : ''}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[1px] bg-paper-deep">
                    <div
                      className={`h-full rounded-[1px] ${masteryBand(row.mastery).className}`}
                      style={{ width: `${Math.max(row.mastery, 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  )
}
