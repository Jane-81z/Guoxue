import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet'
import { IconPlay } from './Icons'
import { splitBySilence, type Envelope } from '../lib/audioSplit'
import { formatMs } from '../lib/audioEnvelope'
import type { Passage } from '../types'

export interface SplitClip {
  passageId: string
  startMs: number
  endMs: number
}

interface AudioSplitSheetProps {
  open: boolean
  fileName: string
  /** 同一个音频文件的 object URL，用于逐段试听 */
  fileUrl: string
  envelope: Envelope
  /** 这一篇的全部段（整篇都录，所以按顺序一一对应） */
  passages: Passage[]
  onConfirm: (clips: SplitClip[]) => void
  onClose: () => void
}

const THRESHOLD_CHOICES = [1, 1.5, 2, 2.5, 3]

export default function AudioSplitSheet({
  open,
  fileName,
  fileUrl,
  envelope,
  passages,
  onConfirm,
  onClose,
}: AudioSplitSheetProps) {
  const [minSilenceSeconds, setMinSilenceSeconds] = useState(2)
  const [cuts, setCuts] = useState<number[]>([])
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopAtRef = useRef<number | null>(null)

  /** 按当前阈值重新自动切一遍 */
  useEffect(() => {
    if (!open) return
    const result = splitBySilence(envelope, { minSilenceSeconds })
    setCuts(result.cuts.slice(0, passages.length - 1))
  }, [open, envelope, minSilenceSeconds, passages.length])

  const durationMs = envelope.durationMs
  const segments = useMemo(() => {
    const bounds = [0, ...cuts, durationMs]
    const list: { startMs: number; endMs: number }[] = []
    for (let i = 0; i < bounds.length - 1; i += 1) {
      list.push({ startMs: Math.round(bounds[i]), endMs: Math.round(bounds[i + 1]) })
    }
    return list
  }, [cuts, durationMs])

  const matched = segments.length === passages.length

  // 画波形 + 切点
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    const styles = getComputedStyle(document.documentElement)
    const ground = `rgb(${styles.getPropertyValue('--c-well').trim()})`
    const ink = `rgb(${styles.getPropertyValue('--c-ghost').trim()})`
    const lit = `rgb(${styles.getPropertyValue('--c-lit').trim()})`
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, width, height)

    const bars = Math.max(1, Math.floor(width))
    const per = envelope.rms.length / bars
    ctx.fillStyle = ink
    for (let x = 0; x < bars; x += 1) {
      let peak = 0
      for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i += 1) {
        if (envelope.rms[i] > peak) peak = envelope.rms[i]
      }
      const h = Math.max(1, Math.min(1, peak * 1.6) * (height - 8))
      ctx.fillRect(x, (height - h) / 2, 1, h)
    }
    ctx.fillStyle = lit
    for (const cut of cuts) {
      const x = Math.round((cut / durationMs) * width)
      ctx.fillRect(x - 1, 0, 2, height)
    }
  }, [open, envelope, cuts, durationMs])

  /** 试听某一段：用同一个文件，按区间播放 */
  const preview = (index: number) => {
    const audio = audioRef.current
    const segment = segments[index]
    if (!audio || !segment) return
    stopAtRef.current = segment.endMs / 1000
    audio.currentTime = segment.startMs / 1000
    void audio.play()
    setPlayingIndex(index)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      if (stopAtRef.current != null && audio.currentTime >= stopAtRef.current) {
        audio.pause()
        stopAtRef.current = null
        setPlayingIndex(null)
      }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [])

  const toggleAt = (clientX: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const time = Math.round(ratio * durationMs)
    // 落在已有切点附近就删掉它，否则加一个
    const near = cuts.findIndex((cut) => Math.abs(cut - time) < durationMs * 0.01)
    if (near >= 0) {
      setCuts((prev) => prev.filter((_, i) => i !== near))
      return
    }
    setCuts((prev) => [...prev, time].sort((a, b) => a - b))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="切分整篇录音"
      subtitle={`${fileName} · 共 ${formatMs(durationMs)}`}
      footer={
        <div className="flex items-center gap-2">
          <span
            className={`readout flex-1 text-[13px] ${matched ? 'text-done' : 'text-alert'}`}
            aria-live="polite"
          >
            已切 {segments.length} 段 / 需要 {passages.length} 段
            {matched ? '　✓ 可以写入' : segments.length > passages.length ? '　删掉多余切点' : '　补几个切点'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!matched}
            onClick={() =>
              onConfirm(
                passages.map((passage, index) => ({
                  passageId: passage.id,
                  startMs: segments[index].startMs,
                  endMs: segments[index].endMs,
                })),
              )
            }
          >
            写入
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] text-dim">
              点波形加切点，点已有切点可删；每段之间停 ≥ {minSilenceSeconds} 秒即自动切开
            </span>
          </div>
          <canvas
            ref={canvasRef}
            className="h-[120px] w-full border border-hairline"
            style={{ borderRadius: 'var(--c-radius)' }}
            onClick={(event) => toggleAt(event.clientX, event.currentTarget)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {THRESHOLD_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${minSilenceSeconds === value ? 'chip-active' : ''}`}
                onClick={() => setMinSilenceSeconds(value)}
              >
                停 {value} 秒
              </button>
            ))}
          </div>
        </div>

        <audio ref={audioRef} src={fileUrl} className="hidden" />

        <ul className="space-y-1.5">
          {segments.map((segment, index) => {
            const passage = passages[index]
            const tooMany = index >= passages.length
            return (
              <li
                key={`${segment.startMs}-${index}`}
                className={`flex items-center gap-2 border bg-panel px-3 py-2 ${
                  tooMany ? 'border-alert/45' : 'border-hairline'
                }`}
                style={{ borderRadius: 'var(--c-radius)' }}
              >
                <span className="readout w-6 shrink-0 text-center text-[13px] text-dim">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-fg">
                    {passage ? passage.text.slice(0, 18) : '（多余的段）'}
                  </span>
                  <span className="readout mt-0.5 block text-[10px] tracking-[0.12em] text-dim">
                    {formatMs(segment.startMs)} – {formatMs(segment.endMs)} ·{' '}
                    {Math.round((segment.endMs - segment.startMs) / 1000)}s
                    {passage && !passage.isRecite ? '　不背' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="chip shrink-0"
                  onClick={() => preview(index)}
                >
                  <IconPlay className="h-3.5 w-3.5" />
                  {playingIndex === index ? '播放中' : '试听'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
