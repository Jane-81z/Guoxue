import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import SegmentDigit, { type SegmentState } from '../components/SegmentDigit'
import {
  IconChevron,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
} from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { usePlayerStore } from '../store/player'
import { formatDuration, passagesOfWork } from '../lib/selectors'
import type { PlayMode } from '../types'

const RATES = [0.5, 0.75, 1, 1.25, 1.5]
const REPEATS = [1, 2, 3, 5]

/** 走带时间用八段字形读数，冒号保持等宽文字 */
function SegmentTime({
  text,
  state = 'lit',
  height = 15,
}: {
  text: string
  state?: SegmentState
  height?: number
}) {
  return (
    <span className="flex items-end gap-[1px]">
      {text.split('').map((char, index) => (
        <SegmentDigit key={`${char}-${index}`} char={char} state={state} height={height} />
      ))}
    </span>
  )
}

export default function PlayerPage() {
  const { workId } = useParams()
  return workId ? <PlaylistView workId={workId} /> : <WorkPicker />
}

function WorkPicker() {
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const navigate = useNavigate()

  const rows = useMemo(
    () =>
      works
        .map((work) => {
          const items = passagesOfWork(passages, work.id)
          return {
            work,
            total: items.length,
            withAudio: items.filter((p) => p.audioId).length,
          }
        })
        .sort((a, b) => b.withAudio - a.withAudio || a.work.createdAt - b.work.createdAt),
    [works, passages],
  )

  return (
    <>
      <PageHeader title="播放列表" subtitle="一段一首，可连续播放" back={false} />
      <div className="mx-auto max-w-2xl px-4 py-4">
        {rows.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <p className="font-song text-lg text-ink">还没有篇目</p>
            <p className="mt-2 text-sm text-ink-faint">导入文本并上传录音后，这里就能像音乐一样听。</p>
            <Link to="/import" className="btn btn-primary mt-4">
              去导入
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map(({ work, total, withAudio }) => (
              <li key={work.id}>
                <button
                  type="button"
                  className="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-paper-deep/50"
                  onClick={() => navigate(`/player/${work.id}`)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--c-radius)] border border-paper-line text-ink-soft">
                    <IconPlay className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-song text-[17px] text-ink">{work.title}</span>
                    <span className="meta mt-0.5 block">
                      {withAudio ? `${withAudio} 段有录音` : '尚未上传录音'}
                      {total ? `　共 ${total} 段` : ''}
                    </span>
                  </span>
                  <IconChevron className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function PlaylistView({ workId }: { workId: string }) {
  const navigate = useNavigate()
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const settings = useAppStore((s) => s.settings)
  const currentId = usePlayerStore((s) => s.currentPassageId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const activeWorkId = usePlayerStore((s) => s.workId)
  const loadWork = usePlayerStore((s) => s.loadWork)
  const playPassage = usePlayerStore((s) => s.playPassage)

  const work = works.find((w) => w.id === workId)
  const items = useMemo(() => passagesOfWork(passages, workId), [passages, workId])
  const audioIds = useMemo(() => items.filter((p) => p.audioId).map((p) => p.id), [items])
  const audioKey = audioIds.join(',')

  useEffect(() => {
    if (!work) return
    if (activeWorkId === workId) return
    loadWork(workId, audioIds)
  }, [work, workId, activeWorkId, audioKey, audioIds, loadWork])

  if (!work) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-ink-faint">篇目不存在</p>
        <button type="button" className="btn btn-ghost mt-3" onClick={() => navigate('/player')}>
          返回播放列表
        </button>
      </div>
    )
  }

  const current = items.find((p) => p.id === currentId)
  const hasAudio = audioIds.length > 0

  return (
    <>
      <PageHeader
        title={work.title}
        subtitle={`${audioIds.length} 段有录音　共 ${items.length} 段`}
        back
        onBack={() => navigate('/player')}
      />

      <div className="mx-auto max-w-2xl px-4 pb-[calc(180px+env(safe-area-inset-bottom))] pt-4">
        {!hasAudio ? (
          <div className="card px-4 py-5 text-center">
            <p className="text-sm text-ink-faint">
              这一篇还没有录音。到「篇目」页展开本篇，给每段上传音频即可。
            </p>
          </div>
        ) : null}

        <ul className="space-y-1.5">
          {items.map((passage, index) => {
            const active = passage.id === currentId
            const playable = !!passage.audioId
            return (
              <li key={passage.id}>
                <button
                  type="button"
                  disabled={!playable}
                  className={`flex w-full items-center gap-3 rounded-[var(--c-radius)] border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-ink/25 bg-paper-deep'
                      : 'border-transparent hover:bg-paper-deep/50'
                  } ${playable ? '' : 'opacity-45'}`}
                  onClick={() => void playPassage(passage.id)}
                >
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-ink-faint">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-song text-[15px] text-ink">
                      {passage.text}
                    </span>
                    <span className="meta mt-0.5 block">
                      {playable ? '有录音' : '未录音'}
                      {settings.player.lastPlayed[workId] === passage.id ? '　上次听到这里' : ''}
                    </span>
                  </span>
                  {active && isPlaying ? (
                    <span className="shrink-0 text-[11px] text-jade">播放中</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {current ? (
        <PlayerBar
          label={`第 ${current.order + 1} 段　${current.text.slice(0, 16)}${
            current.text.length > 16 ? '…' : ''
          }`}
        />
      ) : null}
    </>
  )
}

/** 独立订阅播放状态，避免进度更新导致整个列表重绘 */
function PlayerBar({ label }: { label: string }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isLoading = usePlayerStore((s) => s.isLoading)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const rate = usePlayerStore((s) => s.rate)
  const repeatCount = usePlayerStore((s) => s.repeatCount)
  const mode = usePlayerStore((s) => s.mode)
  const error = usePlayerStore((s) => s.error)
  const toggle = usePlayerStore((s) => s.toggle)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const seek = usePlayerStore((s) => s.seek)
  const setRate = usePlayerStore((s) => s.setRate)
  const setRepeatCount = usePlayerStore((s) => s.setRepeatCount)
  const setMode = usePlayerStore((s) => s.setMode)

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 px-3">
        <div className="rounded-[var(--c-radius)] border border-paper-line bg-paper-soft px-3.5 pb-2.5 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-song text-sm text-ink">{label}</p>
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            <SegmentTime text={formatDuration(currentTime * 1000)} />
            <span className="readout text-[11px] text-ink-faint">/</span>
            <SegmentTime text={formatDuration(duration * 1000)} state="dim" />
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          className="mt-1.5 h-1 w-full accent-[#23211E]"
          onChange={(e) => seek(Number.parseFloat(e.target.value))}
        />

        <div className="mt-1.5 flex items-center justify-between">
          <button
            type="button"
            aria-label="循环模式"
            className="flex h-8 min-w-14 items-center justify-center gap-1 rounded-[var(--c-radius)] border border-paper-line px-2 text-[11px] text-ink-soft"
            onClick={() => {
              const nextMode: PlayMode =
                mode === 'sequence' ? 'repeatAll' : mode === 'repeatAll' ? 'repeatOne' : 'sequence'
              setMode(nextMode)
            }}
          >
            {mode === 'repeatOne' ? (
              <>
                <IconRepeatOne className="h-3.5 w-3.5" /> 单段
              </>
            ) : mode === 'repeatAll' ? (
              <>
                <IconRepeat className="h-3.5 w-3.5" /> 整篇
              </>
            ) : (
              '顺序'
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="上一段"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] text-ink-soft"
              onClick={prev}
            >
              <IconPrev className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={isPlaying ? '暂停' : '播放'}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--c-radius)] bg-ink text-paper-soft"
              onClick={toggle}
            >
              {isLoading ? (
                <span className="text-xs">…</span>
              ) : isPlaying ? (
                <IconPause className="h-5 w-5" />
              ) : (
                <IconPlay className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              aria-label="下一段"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] text-ink-soft"
              onClick={next}
            >
              <IconNext className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-w-14 justify-end gap-1">
            <select
              aria-label="播放速度"
              className="rounded-[var(--c-radius)] border border-paper-line bg-paper-soft px-1.5 py-1 text-[11px] text-ink-soft"
              value={rate}
              onChange={(e) => setRate(Number.parseFloat(e.target.value))}
            >
              {RATES.map((item) => (
                <option key={item} value={item}>
                  {item}×
                </option>
              ))}
            </select>
            <select
              aria-label="复读遍数"
              className="rounded-[var(--c-radius)] border border-paper-line bg-paper-soft px-1.5 py-1 text-[11px] text-ink-soft"
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number.parseInt(e.target.value, 10))}
            >
              {REPEATS.map((count) => (
                <option key={count} value={count}>
                  {count} 遍
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="mt-1.5 text-[11px] text-cinnabar">{error}</p> : null}
      </div>
    </div>
  )
}
