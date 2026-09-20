import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import Dialog from './Dialog'
import RubyText from './RubyText'
import { formatMs } from '../lib/audioEnvelope'
import { checkRecorderSupport, startRecording, type RecordingHandle } from '../lib/recorder'
import type { RubyToken } from '../types'

interface RecordSheetProps {
  open: boolean
  /** 例如「第 3 段」 */
  passageLabel: string
  /** 顶上一行小字，一般是篇名 */
  workTitle: string
  /** 文件名（不含扩展名） */
  fileBaseName: string
  /** 要照着念的那一段：注音后的逐字 token */
  tokens: RubyToken[]
  /** 打开时拼音的默认显隐（跟设置里的开关一致） */
  pinyinDefault: boolean
  /** 正文竖排（跟设置一致） */
  vertical: boolean
  onUse: (file: File) => void | Promise<void>
  /** 退回「选文件导入」那条老路 */
  onPickFile: () => void
  onClose: () => void
}

type Phase = 'idle' | 'recording' | 'ready'

const BAR_COUNT = 40

/**
 * 段落录音面板：点一下就开始录，录完直接挂到这一段上。
 * 用浏览器原生录音（见 lib/recorder.ts），录出来就是普通 File，
 * 与「选文件导入」完全同一条落库路径。
 */
export default function RecordSheet({
  open,
  passageLabel,
  workTitle,
  fileBaseName,
  tokens,
  pinyinDefault,
  vertical,
  onUse,
  onPickFile,
  onClose,
}: RecordSheetProps) {
  const support = checkRecorderSupport()
  const [phase, setPhase] = useState<Phase>('idle')
  const [showPinyin, setShowPinyin] = useState(pinyinDefault)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const handleRef = useRef<RecordingHandle | null>(null)
  const startedAtRef = useRef(0)
  const urlRef = useRef<string | null>(null)

  const releaseUrl = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }

  // 打开时回到初始状态
  useEffect(() => {
    if (!open) return
    setPhase('idle')
    setElapsedMs(0)
    setLevels([])
    setFile(null)
    setUrl(null)
    setError(null)
    setBusy(false)
    setConfirmDiscard(false)
    setShowPinyin(pinyinDefault)
    releaseUrl()
  }, [open, pinyinDefault])

  // 离开这一页时别把麦克风留着
  useEffect(
    () => () => {
      handleRef.current?.cancel()
      handleRef.current = null
      releaseUrl()
    },
    [],
  )

  // 录音中的计时与电平
  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
      const next = handleRef.current?.level() ?? 0
      setLevels((prev) => [...prev.slice(-(BAR_COUNT - 1)), next])
    }, 100)
    return () => window.clearInterval(id)
  }, [phase])

  const begin = async () => {
    setError(null)
    setBusy(true)
    try {
      handleRef.current = await startRecording(fileBaseName)
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setLevels([])
      setPhase('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法开始录音')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    const handle = handleRef.current
    if (!handle) return
    setBusy(true)
    try {
      const recorded = await handle.stop()
      handleRef.current = null
      releaseUrl()
      const nextUrl = URL.createObjectURL(recorded)
      urlRef.current = nextUrl
      setFile(recorded)
      setUrl(nextUrl)
      setPhase('ready')
    } catch (err) {
      handleRef.current = null
      setPhase('idle')
      setError(err instanceof Error ? err.message : '录音结束失败')
    } finally {
      setBusy(false)
    }
  }

  const discard = () => {
    releaseUrl()
    setFile(null)
    setUrl(null)
    setElapsedMs(0)
    setLevels([])
    setPhase('idle')
  }

  const use = async () => {
    if (!file) return
    setBusy(true)
    try {
      await onUse(file)
      releaseUrl()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const requestClose = () => {
    if (phase === 'recording') {
      setConfirmDiscard(true)
      return
    }
    handleRef.current?.cancel()
    handleRef.current = null
    releaseUrl()
    onClose()
  }

  const recording = phase === 'recording'
  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      {!support.supported ? (
        <button type="button" className="btn btn-primary" onClick={onPickFile}>
          改用「选文件」
        </button>
      ) : phase === 'idle' ? (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void begin()}
          >
            {busy ? '正在打开麦克风…' : '开始录音'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onPickFile}>
            改用「选文件」
          </button>
        </>
      ) : recording ? (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void finish()}
          >
            停止录音
          </button>
          <button type="button" className="btn btn-ghost" onClick={requestClose}>
            放弃
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void use()}
          >
            用这一段
          </button>
          <button type="button" className="btn btn-ghost" onClick={discard}>
            重录
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={requestClose}
        title={`录音 · ${passageLabel}`}
        subtitle={workTitle}
        footer={footer}
      >
        <div className="space-y-4">
          {!support.supported ? (
            <div
              className="border border-alert/45 bg-panel px-3.5 py-3"
              style={{ borderRadius: 'var(--c-radius)' }}
            >
              <p className="text-[15px] text-alert">这台设备/浏览器现在录不了</p>
              <p className="mt-1 text-[13px] leading-relaxed text-dim">
                {support.reason}。可以先在「文件」App 里备一段 m4a，用「选文件」导入。
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              className="border border-alert/45 bg-panel px-3.5 py-3"
              style={{ borderRadius: 'var(--c-radius)' }}
            >
              <p className="text-[13px] leading-relaxed text-alert">{error}</p>
            </div>
          ) : null}

          {/* 仪表钉在顶上：念长文时往下滚，计时与电平也不会走掉 */}
          <div className="sticky top-[-16px] z-10 -mx-4 border-b border-hairline bg-paper px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <span
                role="timer"
                aria-label="录音计时"
                className={`readout shrink-0 text-[42px] leading-none ${recording ? 'text-lit' : 'text-dim'}`}
              >
                {formatMs(elapsedMs)}
              </span>
              <span className="ml-auto shrink-0 readout text-[10px] tracking-[0.18em] text-dim">
                {recording ? 'REC' : phase === 'ready' ? 'READY' : 'STANDBY'}
              </span>
            </div>

            <div className="mt-2 flex h-[26px] items-end gap-[2px]" aria-label="录音电平">
              {(levels.length ? levels : Array.from({ length: BAR_COUNT }, () => 0)).map(
                (value, index) => (
                  <span
                    key={index}
                    className={`w-full ${recording ? 'bg-lit' : 'bg-hairline'}`}
                    style={{
                      height: `${Math.max(2, Math.round(value * 26))}px`,
                      borderRadius: '1px',
                      opacity: recording ? 0.4 + value * 0.6 : 1,
                    }}
                  />
                ),
              )}
            </div>
          </div>

          <div
            className="min-h-[42vh] border border-hairline bg-well px-3.5 py-4"
            style={{ borderRadius: 'var(--c-radius)' }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="readout text-[10px] tracking-[0.18em] text-dim">
                对着这一段念
              </span>
              <button
                type="button"
                className={`chip ${showPinyin ? 'chip-active' : ''}`}
                aria-pressed={showPinyin}
                onClick={() => setShowPinyin((value) => !value)}
              >
                {showPinyin ? '拼音 开' : '拼音 关'}
              </button>
            </div>
            <div
              className={`text-body-stage text-fg ${
                vertical ? 'text-vertical max-h-[54vh] overflow-x-auto' : ''
              }`}
            >
              <RubyText tokens={tokens} showPinyin={showPinyin} />
            </div>
          </div>

          {url ? <audio aria-label="录音试听" className="w-full" controls src={url} /> : null}

          <p className="readout text-[10px] leading-relaxed tracking-[0.12em] text-dim">
            {recording
              ? '录音中请不要锁屏或切到别的 App —— iOS 会直接掐断麦克风'
              : '整段一次念完即可：录完点「停止录音」，试听没问题再点「用这一段」'}
          </p>
        </div>
      </Sheet>

      <Dialog
        open={confirmDiscard}
        title="正在录音，确定放弃？"
        description="放弃后这段录音不会保存。"
        confirmText="放弃"
        danger
        onConfirm={() => {
          handleRef.current?.cancel()
          handleRef.current = null
          setConfirmDiscard(false)
          discard()
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}
