import { masteryBand, masteryScore } from '../lib/srs'
import type { SrsState } from '../types'

interface MasteryBarProps {
  srs: SrsState
  showLabel?: boolean
  className?: string
}

export default function MasteryBar({ srs, showLabel = true, className = '' }: MasteryBarProps) {
  const score = masteryScore(srs)
  const band = masteryBand(score)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-paper-deep">
        <div
          className={`h-full rounded-[1px] transition-all duration-500 ${band.className}`}
          style={{ width: `${Math.max(score, 2)}%` }}
        />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
          {band.label} {score}
        </span>
      ) : null}
    </div>
  )
}
