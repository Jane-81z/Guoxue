import { Link, useLocation } from 'react-router-dom'
import { usePlayerStore } from '../store/player'
import { useAppStore } from '../store/useAppStore'
import { IconNext, IconPause, IconPlay } from './Icons'

export default function MiniPlayer() {
  const currentPassageId = usePlayerStore((s) => s.currentPassageId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const toggle = usePlayerStore((s) => s.toggle)
  const next = usePlayerStore((s) => s.next)
  const passages = useAppStore((s) => s.passages)
  const works = useAppStore((s) => s.works)
  const location = useLocation()

  if (!currentPassageId) return null
  if (location.pathname.startsWith('/player')) return null

  const passage = passages.find((p) => p.id === currentPassageId)
  if (!passage) return null
  const work = works.find((w) => w.id === passage.workId)

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 px-3 pb-1">
      <div className="flex items-center gap-3 rounded-[var(--c-radius)] border border-paper-line bg-paper-soft px-3 py-2">
        <Link to={`/player/${passage.workId}`} className="min-w-0 flex-1">
          <p className="truncate font-song text-sm text-ink">
            {work ? `${work.title}・第 ${passage.order + 1} 段` : '正在播放'}
          </p>
          <p className="truncate text-[11px] text-ink-faint">
            {passage.text.slice(0, 22)}
            {passage.text.length > 22 ? '…' : ''}
          </p>
        </Link>
        <button
          type="button"
          aria-label={isPlaying ? '暂停' : '播放'}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] border border-paper-line text-ink"
          onClick={toggle}
        >
          {isPlaying ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="下一段"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] text-ink-soft"
          onClick={next}
        >
          <IconNext className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
