import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import RubyText from '../components/RubyText'
import SegmentDigit from '../components/SegmentDigit'
import StatsPanel from '../components/StatsPanel'
import { IconChart, IconEye, IconEyeOff } from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { usePlayerStore } from '../store/player'
import { useToday } from '../hooks/useToday'
import { recitePassagesOf, workMap } from '../lib/selectors'
import { RATINGS, createSrsState, masteryBand, masteryScore } from '../lib/srs'
import { resolveTokens } from '../lib/pinyin'
import { formatCn, relativeDay, weekdayCn } from '../lib/date'
import { clampPace, estimateMinutes, readoutDigits, sessionSeconds } from '../lib/estimate'
import type { RatingKey } from '../types'

/** 长按多久算数 */
const HOLD_MS = 450

export default function ReviewPage() {
  const status = useAppStore((s) => s.status)
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const audios = useAppStore((s) => s.audios)
  const settings = useAppStore((s) => s.settings)
  const dailyStats = useAppStore((s) => s.dailyStats)
  const rateWork = useAppStore((s) => s.rateWork)
  const today = useToday()
  const playingPassageId = usePlayerStore((s) => s.currentPassageId)

  const [queue, setQueue] = useState<string[] | null>(null)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [phase, setPhase] = useState<'board' | 'reciting'>('board')
  /** 已显示到第几段：0 = 整篇熄灭，N = 全文显示 */
  const [revealedCount, setRevealedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [holdFill, setHoldFill] = useState(0)
  const [statsOpen, setStatsOpen] = useState(false)
  const holdTimer = useRef<number | null>(null)

  const pace = clampPace(settings.recitePace)
  const worksById = useMemo(() => workMap(works), [works])
  const audioDurationByPassage = useMemo(
    () =>
      new Map(
        audios
          .filter((a): a is typeof a & { passageId: string } => !!a.passageId)
          .map((a) => [a.passageId, a.durationMs]),
      ),
    [audios],
  )

  /** 今日队列：以篇为单位，只算有要背段的篇 */
  const dueIds = useMemo(() => {
    const reciteByWork = new Set(passages.filter((p) => p.isRecite).map((p) => p.workId))
    return works
      .filter((w) => reciteByWork.has(w.id))
      .map((w) => ({ work: w, srs: w.srs ?? createSrsState(today) }))
      .filter(({ srs }) => (srs.history.length ? srs.dueAt <= today : true))
      .sort((a, b) => {
        if (a.srs.dueAt !== b.srs.dueAt) return a.srs.dueAt < b.srs.dueAt ? -1 : 1
        const ma = masteryScore(a.srs)
        const mb = masteryScore(b.srs)
        if (ma !== mb) return ma - mb
        return a.work.createdAt - b.work.createdAt
      })
      .map(({ work }) => work.id)
  }, [works, passages, today])

  // 一天一局：日期变了就重开
  useEffect(() => {
    setQueue(null)
    setPhase('board')
    setRevealedCount(0)
  }, [today])

  useEffect(() => {
    if (queue !== null) return
    if (status !== 'ready') return
    setQueue(dueIds)
    setSessionTotal(dueIds.length)
  }, [queue, dueIds, status])

  const activeQueue = useMemo(
    () => (queue ?? []).filter((id) => worksById.has(id)),
    [queue, worksById],
  )
  const currentWorkId = activeQueue[0]
  const currentWork = currentWorkId ? worksById.get(currentWorkId) : undefined
  const currentPassages = useMemo(
    () => (currentWorkId ? recitePassagesOf(passages, currentWorkId) : []),
    [passages, currentWorkId],
  )

  const remainingSeconds = useMemo(
    () =>
      activeQueue.reduce((sum, workId) => {
        const list = recitePassagesOf(passages, workId)
        return sum + sessionSeconds(list, audioDurationByPassage, pace)
      }, 0),
    [activeQueue, passages, audioDurationByPassage, pace],
  )

  const remainingMinutes = estimateMinutes(remainingSeconds)
  const minuteDigits = readoutDigits(remainingMinutes)
  const minuteHeadIsGhost = remainingMinutes < 10

  const todayStat = dailyStats.find((s) => s.date === today)
  const checkedIn = todayStat?.checkedIn ?? false
  const hasRecite = passages.some((p) => p.isRecite)
  /** 读数用「今日」口径：分母至少等于今天已背篇数，重载后不会显示成 0/0 */
  const reviewedToday = todayStat?.reviewedCount ?? 0
  const todayTotal = Math.max(sessionTotal, reviewedToday)

  const nextBatch = useMemo(() => {
    const upcoming = works.filter((w) => (w.srs?.dueAt ?? today) > today)
    if (!upcoming.length) return null
    const nextDate = upcoming.reduce(
      (min, w) => ((w.srs?.dueAt ?? today) < min ? w.srs?.dueAt ?? today : min),
      upcoming[0].srs?.dueAt ?? today,
    )
    return { date: nextDate, count: upcoming.filter((w) => (w.srs?.dueAt ?? today) === nextDate).length }
  }, [works, today])

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearInterval(holdTimer.current)
      holdTimer.current = null
    }
    setHoldFill(0)
  }, [])

  const startSession = useCallback(() => {
    clearHold()
    setRevealedCount(0)
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

  const startAtWork = useCallback((workId: string) => {
    setQueue((prev) => {
      if (!prev) return prev
      const rest = prev.filter((id) => id !== workId)
      return prev.includes(workId) ? [workId, ...rest] : prev
    })
    setRevealedCount(0)
    setPhase('reciting')
  }, [])

  const handleRate = useCallback(
    async (rating: RatingKey) => {
      if (!currentWorkId || busy) return
      setBusy(true)
      try {
        await rateWork(currentWorkId, rating)
        setQueue((q) => (q ? q.filter((id) => id !== currentWorkId) : q))
        setRevealedCount(0)
      } finally {
        setBusy(false)
      }
    },
    [busy, currentWorkId, rateWork],
  )

  const handleSkip = useCallback(() => {
    setQueue((q) => {
      if (!q || q.length <= 1) return q
      return [...q.slice(1), q[0]]
    })
    setRevealedCount(0)
  }, [])

  const currentSrs = currentWork ? currentWork.srs ?? createSrsState(today) : null
  const totalToRecite = currentPassages.length
  const fullyRevealed = revealedCount >= totalToRecite

  return (
    <>
      <PageHeader
        title="今日复习"
        subtitle={`${formatCn(today)}　${weekdayCn(today)}　待复习 ${dueIds.length} 篇`}
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
            {/* 读数区：已完成/到期（按篇）+ 预计用时 */}
            <section className="panel mb-3 px-4 py-3.5">
              <p className="sr-only">
                今天需背 {todayTotal} 篇，已完成 {reviewedToday} 篇，预计还需 {remainingMinutes} 分钟
              </p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-end gap-1">
                    {String(reviewedToday)
                      .split('')
                      .map((char, index) => (
                        <SegmentDigit key={`done-${index}`} char={char} state="lit" height={54} />
                      ))}
                    <SegmentDigit char="/" state="dim" height={54} />
                    {String(todayTotal)
                      .split('')
                      .map((char, index) => (
                        <SegmentDigit key={`due-${index}`} char={char} state="dim" height={54} />
                      ))}
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.24em] text-dim">已完成 / 今日 DUE</p>
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
                {/* 今日任务：一列固定格子，一格 = 一篇 */}
                <ul className="mb-28 space-y-2">
                  {dueIds.map((workId) => {
                    const work = worksById.get(workId)
                    if (!work) return null
                    const items = recitePassagesOf(passages, workId)
                    const isCurrent = workId === currentWorkId
                    const isDone = !activeQueue.includes(workId)
                    const minutes = estimateMinutes(
                      sessionSeconds(items, audioDurationByPassage, pace),
                    )
                    const srs = work.srs ?? createSrsState(today)
                    const overdue = Math.max(
                      0,
                      Math.round(
                        (new Date(`${today}T00:00:00`).getTime() -
                          new Date(`${srs.dueAt}T00:00:00`).getTime()) /
                          86400000,
                      ),
                    )
                    return (
                      <li key={workId}>
                        <button
                          type="button"
                          disabled={isDone}
                          className={`cellrow w-full text-left ${isCurrent ? 'cellrow-current' : ''} ${
                            overdue > 0 && !isDone ? 'cellrow-alert' : ''
                          }`}
                          onClick={() => startAtWork(workId)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[17px] leading-tight text-fg">
                              {work.title}
                            </span>
                            <span className="mt-1 block text-[13px] text-dim">
                              {items.length} 段 ·{' '}
                              {isDone ? '已完成' : `约 ${Math.max(minutes, 1)} 分钟`}
                              {overdue > 0 && !isDone ? (
                                <span className="blink-alert ml-2">逾期 {overdue} 天</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="segbar shrink-0">
                            {items.slice(0, 6).map((p, index2) => (
                              <i
                                key={p.id}
                                className={`seg ${isDone ? 'seg-done' : isCurrent && index2 === 0 ? 'seg-lit' : ''}`}
                              />
                            ))}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* 长按键：一次「拉动」进入背诵态 */}
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
                {currentWork ? (
                  <>
                    {/* 篇头：篇名 + 要背段数 + 预计用时 */}
                    <div className="panel px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[20px] leading-tight text-fg">
                          {currentWork.title}
                        </span>
                        <span className="readout shrink-0 text-[13px] text-dim">
                          {totalToRecite} 段 · 约{' '}
                          {Math.max(
                            estimateMinutes(
                              sessionSeconds(currentPassages, audioDurationByPassage, pace),
                            ),
                            1,
                          )}{' '}
                          分钟
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[13px] text-dim">
                        <span>{[currentWork.dynasty, currentWork.author].filter(Boolean).join('・')}</span>
                        <span className="ml-auto readout">
                          已显示 {revealedCount}/{totalToRecite} 段
                        </span>
                      </div>
                    </div>

                    {/* 整篇正文：默认全隐藏，可逐段提示 */}
                    <div className="panel px-4 py-4">
                      {revealedCount === 0 ? (
                        <button
                          type="button"
                          className="flex h-[180px] w-full flex-col items-center justify-center gap-2 bg-well text-ghost"
                          style={{ borderRadius: 'var(--c-radius)' }}
                          onClick={() => setRevealedCount(1)}
                        >
                          <IconEyeOff className="h-6 w-6" />
                          <span className="text-[13px] tracking-[0.16em]">整篇熄灭，先背一遍</span>
                          <span className="text-[11px] text-dim">点一下从第一段开始提示</span>
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {currentPassages.slice(0, revealedCount).map((passage) => (
                            <p
                              key={passage.id}
                              className={`text-body text-fg ${
                                settings.vertical ? 'text-vertical max-h-[46vh] overflow-x-auto' : ''
                              }`}
                            >
                              <RubyText
                                tokens={resolveTokens(
                                  passage.text,
                                  passage.pinyinCache,
                                  passage.pinyinOverrides,
                                )}
                                showPinyin={settings.pinyinInReview}
                              />
                            </p>
                          ))}
                          {!fullyRevealed ? (
                            <p className="rounded-[var(--c-radius)] bg-well px-3 py-2 text-[13px] text-dim">
                              还有 {totalToRecite - revealedCount} 段未显示
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="chip"
                          disabled={fullyRevealed}
                          onClick={() => setRevealedCount((n) => Math.min(n + 1, totalToRecite))}
                        >
                          <IconEye className="h-3.5 w-3.5" /> 提示下一段
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => setRevealedCount(fullyRevealed ? 0 : totalToRecite)}
                        >
                          {fullyRevealed ? (
                            <>
                              <IconEyeOff className="h-3.5 w-3.5" /> 全部隐藏
                            </>
                          ) : (
                            <>
                              <IconEye className="h-3.5 w-3.5" /> 显示全文
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-pale">
                          {masteryBand(masteryScore(currentSrs!)).label}
                          {currentSrs?.history.length
                            ? `　上次 ${formatCn(currentSrs.lastReviewedAt ?? today)}`
                            : '　新篇'}
                        </span>
                        <button type="button" className="chip" onClick={handleSkip}>
                          跳过
                        </button>
                      </div>
                    </div>

                    {/* 四把评分键钉在底栏上方：整篇一次评分 */}
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
                          今日已背 {reviewedToday} 篇 · 剩余 {readoutDigits(remainingMinutes)} MIN
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
                                  <i className={`seg ${rating.key === 'fluent' ? 'seg-done' : ''}`} />
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

            {phase === 'reciting' && currentWork ? <div className="h-[132px]" aria-hidden /> : null}
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
      <p className="readout text-done text-[24px] leading-none">
        {sessionTotal} / {sessionTotal} 篇
      </p>
      <p className="mt-3 text-[17px] text-fg">
        {sessionTotal === 0 ? '今天没有到期的篇目' : '今日任务已完成'}
      </p>
      <p className="mt-2 text-[13px] tracking-[0.16em] text-dim">
        {checkedIn ? '已打卡 · CHECKED IN' : '尚未打卡'}
      </p>
      {nextBatch ? (
        <p className="mt-3 text-[13px] text-fg-soft">
          下次复习 {formatCn(nextBatch.date)}（{relativeDay(nextBatch.date)}），共 {nextBatch.count}{' '}
          篇
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
