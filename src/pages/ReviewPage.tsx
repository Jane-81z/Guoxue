import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import RubyText from '../components/RubyText'
import StatsPanel from '../components/StatsPanel'
import SegmentDigit from '../components/SegmentDigit'
import { IconChart, IconEye, IconEyeOff } from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { usePlayerStore } from '../store/player'
import { useToday } from '../hooks/useToday'
import { duePassages, workMap } from '../lib/selectors'
import { RATINGS } from '../lib/srs'
import { resolveTokens } from '../lib/pinyin'
import { formatCn, relativeDay, weekdayCn } from '../lib/date'
import {
  clampPace,
  estimateMinutes,
  passageSeconds,
  readoutDigits,
  sessionSeconds,
} from '../lib/estimate'
import type { RatingKey } from '../types'

/** 长按多久算数 */
const HOLD_MS = 450

interface WorkCell {
  workId: string
  title: string
  meta: string
  passages: string[]
  doneCount: number
  overdueDays: number
  minutes: number
}

export default function ReviewPage() {
  const status = useAppStore((s) => s.status)
  const passages = useAppStore((s) => s.passages)
  const works = useAppStore((s) => s.works)
  const audios = useAppStore((s) => s.audios)
  const settings = useAppStore((s) => s.settings)
  const dailyStats = useAppStore((s) => s.dailyStats)
  const ratePassage = useAppStore((s) => s.ratePassage)
  const today = useToday()
  const playingPassageId = usePlayerStore((s) => s.currentPassageId)

  const [queue, setQueue] = useState<string[] | null>(null)
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const [sessionTotal, setSessionTotal] = useState(0)
  const [phase, setPhase] = useState<'board' | 'reciting'>('board')
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [holdFill, setHoldFill] = useState(0)
  const [statsOpen, setStatsOpen] = useState(false)
  const holdTimer = useRef<number | null>(null)

  const pace = clampPace(settings.recitePace)
  const due = useMemo(() => duePassages(passages, today), [passages, today])
  const worksById = useMemo(() => workMap(works), [works])
  const passagesById = useMemo(() => new Map(passages.map((p) => [p.id, p])), [passages])
  const audioDurationByPassage = useMemo(
    () => new Map(audios.map((a) => [a.passageId, a.durationMs])),
    [audios],
  )

  // 一天一局：日期变了就重开
  useEffect(() => {
    setQueue(null)
    setSessionIds([])
    setPhase('board')
    setRevealed(false)
  }, [today])

  useEffect(() => {
    if (queue !== null) return
    if (status !== 'ready') return
    const dueIds = due.map((p) => p.id)
    const session = new Set(dueIds)
    for (const passage of passages) {
      if (passage.isRecite && passage.srs.lastReviewedAt === today) session.add(passage.id)
    }
    const allIds = [...session]
    setQueue(dueIds)
    setSessionIds(allIds)
    setSessionTotal(allIds.length)
  }, [queue, due, status, passages, today])

  const activeQueue = useMemo(
    () => (queue ?? []).filter((id) => passagesById.has(id)),
    [queue, passagesById],
  )
  const currentId = activeQueue[0]
  const current = currentId ? passagesById.get(currentId) : undefined

  const remainingSeconds = useMemo(
    () =>
      sessionSeconds(
        activeQueue.map((id) => passagesById.get(id)!).filter(Boolean),
        audioDurationByPassage,
        pace,
      ),
    [activeQueue, passagesById, audioDurationByPassage, pace],
  )

  const doneCount = Math.max(0, sessionTotal - activeQueue.length)
  const remainingMinutes = estimateMinutes(remainingSeconds)
  const minuteDigits = readoutDigits(remainingMinutes)
  /** 只亮有意义的位：个位数时前导 0 保持幽灵态 */
  const minuteHeadIsGhost = remainingMinutes < 10

  const cells = useMemo<WorkCell[]>(() => {
    const byWork = new Map<string, string[]>()
    for (const id of sessionIds) {
      const passage = passagesById.get(id)
      if (!passage) continue
      const list = byWork.get(passage.workId)
      if (list) list.push(passage.id)
      else byWork.set(passage.workId, [passage.id])
    }
    const list = [...byWork.entries()].map(([workId, ids]) => {
      const work = worksById.get(workId)
      const items = ids.map((id) => passagesById.get(id)!).filter(Boolean)
      const pending = ids.filter((id) => activeQueue.includes(id))
      const overdue = items.reduce((max, p) => {
        const gap = Math.round(
          (new Date(`${today}T00:00:00`).getTime() -
            new Date(`${p.srs.dueAt}T00:00:00`).getTime()) /
            86400000,
        )
        return Math.max(max, gap)
      }, 0)
      const minutes = estimateMinutes(
        sessionSeconds(
          pending.map((id) => passagesById.get(id)!).filter(Boolean),
          audioDurationByPassage,
          pace,
        ),
      )
      return {
        workId,
        createdAt: work?.createdAt ?? 0,
        title: work?.title ?? '未命名',
        meta: `${ids.length} 段 · 约 ${Math.max(minutes, 1)} 分钟`,
        passages: ids,
        doneCount: ids.length - pending.length,
        overdueDays: overdue,
        minutes,
      }
    })
    // 逾期在前，其余按入库顺序：读数板从最该动的那一格开始
    list.sort((a, b) => b.overdueDays - a.overdueDays || a.createdAt - b.createdAt)
    return list.map(({ createdAt: _createdAt, ...cell }) => cell)
  }, [
    sessionIds,
    worksById,
    passagesById,
    activeQueue,
    audioDurationByPassage,
    pace,
    today,
  ])

  const todayStat = dailyStats.find((s) => s.date === today)
  const checkedIn = todayStat?.checkedIn ?? false
  const hasRecite = passages.some((p) => p.isRecite)

  const nextBatch = useMemo(() => {
    const upcoming = passages.filter((p) => p.isRecite && p.srs.dueAt > today)
    if (!upcoming.length) return null
    const nextDate = upcoming.reduce(
      (min, p) => (p.srs.dueAt < min ? p.srs.dueAt : min),
      upcoming[0].srs.dueAt,
    )
    return { date: nextDate, count: upcoming.filter((p) => p.srs.dueAt === nextDate).length }
  }, [passages, today])

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearInterval(holdTimer.current)
      holdTimer.current = null
    }
    setHoldFill(0)
  }, [])

  const startSession = useCallback(() => {
    clearHold()
    setRevealed(false)
    setPhase('reciting')
  }, [clearHold])

  const handleHoldStart = useCallback(() => {
    if (!activeQueue.length) return
    clearHold()
    const startedAt = Date.now()
    holdTimer.current = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / HOLD_MS)
      setHoldFill(ratio)
      if (ratio >= 1) startSession()
    }, 40)
  }, [activeQueue.length, clearHold, startSession])

  const startAtWork = useCallback(
    (ids: string[]) => {
      setQueue((prev) => {
        if (!prev) return prev
        const rest = prev.filter((id) => !ids.includes(id))
        const pending = ids.filter((id) => prev.includes(id))
        return [...pending, ...rest]
      })
      setRevealed(false)
      setPhase('reciting')
    },
    [],
  )

  const handleRate = useCallback(
    async (rating: RatingKey) => {
      if (!currentId || busy) return
      setBusy(true)
      try {
        await ratePassage(currentId, rating)
        setQueue((q) => (q ? q.filter((id) => id !== currentId) : q))
        setRevealed(false)
      } finally {
        setBusy(false)
      }
    },
    [busy, currentId, ratePassage],
  )

  const handleSkip = useCallback(() => {
    setQueue((q) => {
      if (!q || q.length <= 1) return q
      return [...q.slice(1), q[0]]
    })
    setRevealed(false)
  }, [])

  const tokens = useMemo(
    () => (current ? resolveTokens(current.text, current.pinyinCache, current.pinyinOverrides) : []),
    [current],
  )

  const currentWork = current ? worksById.get(current.workId) : undefined
  const currentWorkCell = current
    ? cells.find((c) => c.workId === current.workId)
    : undefined

  return (
    <>
      <PageHeader
        title="今日复习"
        subtitle={`${formatCn(today)}　${weekdayCn(today)}`}
        actions={
          <button
            type="button"
            aria-label="统计面板"
            className="flex h-9 w-9 items-center justify-center border border-hairline text-fg-soft active:bg-well"
            style={{ borderRadius: 'var(--c-radius)' }}
            onClick={() => setStatsOpen(true)}
          >
            <IconChart className="h-4 w-4" />
          </button>
        }
      />

      <div className="mx-auto max-w-2xl px-4 py-4">
        {!hasRecite ? (
          <EmptyBoard />
        ) : (
          <>
            {/* 读数区：已完成/到期 + 预计用时 */}
            <section className="panel mb-3 px-4 py-3.5">
              <p className="sr-only">
                今日需背 {sessionTotal} 段，已完成 {doneCount} 段，预计还需 {remainingMinutes} 分钟
              </p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-end gap-1">
                    {String(doneCount)
                      .split('')
                      .map((char, index) => (
                        <SegmentDigit key={`done-${index}`} char={char} state="lit" height={54} />
                      ))}
                    <SegmentDigit char="/" state="dim" height={54} />
                    {String(sessionTotal)
                      .split('')
                      .map((char, index) => (
                        <SegmentDigit key={`due-${index}`} char={char} state="dim" height={54} />
                      ))}
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.24em] text-dim">DONE / DUE</p>
                </div>
                <div className="text-right">
                  <div className="flex items-end justify-end gap-1">
                    <span className="readout pb-1 text-[13px] text-dim">≈</span>
                    {minuteDigits.split('').map((char, index) => (
                      <SegmentDigit
                        key={`min-${index}`}
                        char={char}
                        state={index === 0 && minuteHeadIsGhost ? 'ghost' : 'lit'}
                        height={42}
                      />
                    ))}
                    <span className="readout pb-1 text-[13px] tracking-[0.16em] text-dim">MIN</span>
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.24em] text-dim">
                    {checkedIn ? '已打卡 · EST' : '预计用时 · EST'}
                  </p>
                </div>
              </div>
            </section>

            {phase === 'board' ? (
              <>
                {/* 今日任务：一列固定格子 */}
                <ul className="mb-28 space-y-2">
                  {cells.map((cell) => {
                    const isCurrent = cell.workId === current?.workId
                    const isDone = cell.doneCount === cell.passages.length
                    return (
                      <li key={cell.workId}>
                        <button
                          type="button"
                          disabled={isDone}
                          className={`cellrow w-full text-left ${
                            isCurrent ? 'cellrow-current' : ''
                          } ${isDone ? 'cellrow-finished' : ''} ${
                            cell.overdueDays > 0 && !isDone ? 'cellrow-alert' : ''
                          }`}
                          onClick={() => startAtWork(cell.passages)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[17px] leading-tight text-fg">
                              {cell.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-dim">
                              {cell.doneCount}/{cell.passages.length} 段 ·{' '}
                              {isDone ? '已完成' : `约 ${Math.max(cell.minutes, 1)} 分钟`}
                              {cell.overdueDays > 0 && !isDone ? (
                                <span className="blink-alert ml-2">
                                  逾期 {cell.overdueDays} 天
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="segbar shrink-0">
                            {cell.passages.slice(0, 5).map((_, barIndex) => {
                              const lit = barIndex < cell.doneCount
                              return (
                                <i
                                  key={barIndex}
                                  className={`seg ${lit ? 'seg-done' : isCurrent ? 'seg-lit' : ''}`}
                                />
                              )
                            })}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* 长按键：「一次拉动」的入口，压在底栏上方 */}
                <div
                  className="fixed inset-x-0 z-30 border-t border-hairline bg-paper px-4 pb-2 pt-3"
                  style={{
                    bottom: playingPassageId
                      ? 'calc(112px + env(safe-area-inset-bottom))'
                      : 'calc(60px + env(safe-area-inset-bottom))',
                  }}
                >
                  <div className="mx-auto max-w-2xl">
                    <button
                      type="button"
                      className={`holdkey ${activeQueue.length ? '' : 'opacity-50'}`}
                      disabled={!activeQueue.length}
                      onPointerDown={handleHoldStart}
                      onPointerUp={clearHold}
                      onPointerLeave={clearHold}
                      onPointerCancel={clearHold}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          startSession()
                        }
                      }}
                    >
                      <span
                        className="holdkey-fill"
                        style={{ width: `${Math.round(holdFill * 100)}%` }}
                      />
                      <span className="relative flex items-center justify-center gap-2.5">
                        <span className="text-[15px] tracking-[0.18em] text-fg">
                          {activeQueue.length ? '长按开始背诵' : '今日已全部完成'}
                        </span>
                        <span className="text-[10px] tracking-[0.22em] text-dim">
                          HOLD {HOLD_MS}MS
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <section className="space-y-3">
                {current ? (
                  <>
                    <div className="panel px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[17px] text-fg">
                          {currentWork?.title ?? '未命名'}
                        </span>
                        <span className="readout shrink-0 text-[13px] text-dim">
                          第 {current.order + 1} 段 · 约{' '}
                          {Math.max(
                            estimateMinutes(
                              passageSeconds(
                                current.text,
                                current.audioId
                                  ? audioDurationByPassage.get(current.id)
                                  : null,
                                pace,
                              ),
                            ),
                            1,
                          )}{' '}
                          分钟
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {currentWorkCell?.passages.slice(0, 8).map((id) => (
                          <i
                            key={id}
                            className={`seg flex-1 ${
                              id === current.id ? 'seg-lit' : 'seg-done'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="panel px-4 py-4">
                      {revealed ? (
                        <div
                          className={`text-body text-fg ${
                            settings.vertical
                              ? 'text-vertical max-h-[46vh] overflow-x-auto'
                              : ''
                          }`}
                          style={
                            { '--body-line-height': String(settings.lineHeight) } as CSSProperties
                          }
                        >
                          <RubyText tokens={tokens} showPinyin={settings.pinyinInReview} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex h-[150px] w-full flex-col items-center justify-center gap-2 bg-well text-ink-faint"
                          style={{ borderRadius: 'var(--c-radius)' }}
                          onClick={() => setRevealed(true)}
                        >
                          <IconEyeOff className="h-6 w-6" />
                          <span className="text-[13px] tracking-[0.16em]">原文熄灭</span>
                        </button>
                      )}
                      {revealed && current.note ? (
                        <p className="mt-3 bg-well px-3 py-2 text-[13px] leading-relaxed text-fg-soft">
                          {current.note}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setRevealed((v) => !v)}
                      >
                        {revealed ? (
                          <>
                            <IconEyeOff className="h-3.5 w-3.5" /> 熄灭原文
                          </>
                        ) : (
                          <>
                            <IconEye className="h-3.5 w-3.5" /> 点亮原文
                          </>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <button type="button" className="chip" onClick={handleSkip}>
                          跳过
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => setPhase('board')}
                        >
                          回到读数板
                        </button>
                      </div>
                    </div>

                    {/* 四把评分键钉在底栏上方，原文框自己滚 */}
                    <div
                      className="fixed inset-x-0 z-30 border-t border-hairline bg-paper px-4 pb-2 pt-3"
                      style={{
                        bottom: playingPassageId
                          ? 'calc(112px + env(safe-area-inset-bottom))'
                          : 'calc(60px + env(safe-area-inset-bottom))',
                      }}
                    >
                      <div className="mx-auto max-w-2xl">
                        <p className="mb-1.5 text-center text-[10px] tracking-[0.2em] text-dim">
                          本轮 {doneCount}/{sessionTotal} · 剩余 {readoutDigits(remainingMinutes)} MIN
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {RATINGS.map((rating) => (
                            <button
                              key={rating.key}
                              type="button"
                              disabled={busy}
                              className="keypad"
                              onClick={() => void handleRate(rating.key)}
                            >
                              <span className="flex items-center gap-2">
                                <span className="segbar w-4">
                                  <i
                                    className={`seg ${
                                      rating.key === 'fluent'
                                        ? 'seg-done'
                                        : rating.key === 'hard'
                                          ? 'seg-alert'
                                          : rating.key === 'blank'
                                            ? 'seg-lit'
                                            : ''
                                    }`}
                                  />
                                  <i
                                    className={`seg ${
                                      rating.key === 'fluent' ? 'seg-done' : ''
                                    }`}
                                  />
                                </span>
                                <span className="text-[15px] text-fg">{rating.label}</span>
                              </span>
                              <span className="pl-6 text-[10px] tracking-[0.08em] text-dim">
                                {rating.hint}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <CompletionBoard
                    sessionTotal={sessionTotal}
                    checkedIn={checkedIn}
                    nextBatch={nextBatch}
                    onBack={() => setPhase('board')}
                  />
                )}
              </section>
            )}

            {phase === 'reciting' && current ? <div className="h-[132px]" aria-hidden /> : null}
          </>
        )}
      </div>

      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
    </>
  )
}

function EmptyBoard() {
  return (
    <div className="panel px-5 py-8 text-center">
      <p className="text-[17px] text-fg">还没有可背的篇目</p>
      <p className="mt-2 text-[13px] leading-relaxed text-dim">
        先把要背的文本粘进来。一行就是一段，导入时可以逐段决定要不要背。
      </p>
      <Link to="/import" className="btn btn-primary mt-4">
        去导入
      </Link>
    </div>
  )
}

function CompletionBoard({
  sessionTotal,
  checkedIn,
  nextBatch,
  onBack,
}: {
  sessionTotal: number
  checkedIn: boolean
  nextBatch: { date: string; count: number } | null
  onBack: () => void
}) {
  return (
    <div className="panel px-5 py-8 text-center">
      <div className="readout text-done text-[42px] leading-none">
        {sessionTotal}/{sessionTotal}
      </div>
      <p className="mt-3 text-[17px] text-fg">
        {sessionTotal === 0 ? '今日无到期的卡片' : '今日任务已完成'}
      </p>
      <p className="mt-2 text-[13px] tracking-[0.16em] text-dim">
        {checkedIn ? '已打卡 · CHECKED IN' : '尚未打卡'}
      </p>
      {nextBatch ? (
        <p className="mt-3 text-[13px] text-fg-soft">
          下次复习 {formatCn(nextBatch.date)}（{relativeDay(nextBatch.date)}），共{' '}
          {nextBatch.count} 段
        </p>
      ) : null}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" className="chip" onClick={onBack}>
          回到读数板
        </button>
        <Link to="/library" className="chip">
          去篇目页
        </Link>
        <Link to="/player" className="chip">
          去听录音
        </Link>
      </div>
    </div>
  )
}
