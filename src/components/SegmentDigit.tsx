import type { CSSProperties } from 'react'

/**
 * 八段掩码字形：一个数字由七段构成，点亮的段发光，
 * 未点亮的段以幽灵态保留轮廓——缺席也是设计对象。
 * 非数字字符（斜杠、约等号）退回等宽文字，保持同一高度与字重。
 */
/**
 * `ghost` 是真正未点亮的段（很暗，只留轮廓）；
 * `dim` 是「亮着但不在当前」的段，用于还需要读出来的数字（如到期总数）。
 */
export type SegmentState = 'lit' | 'ghost' | 'dim' | 'done' | 'alert'

const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
}

const FILL: Record<SegmentState, string> = {
  lit: 'rgb(var(--c-lit))',
  ghost: 'rgb(var(--c-lit-ghost))',
  dim: 'rgb(var(--c-ghost))',
  done: 'rgb(var(--c-done))',
  alert: 'rgb(var(--c-alert))',
}

const GLOW: Record<SegmentState, string> = {
  lit: '0 0 10px rgb(var(--c-lit) / 0.55)',
  ghost: 'none',
  dim: 'none',
  done: '0 0 10px rgb(var(--c-done) / 0.45)',
  alert: '0 0 10px rgb(var(--c-alert) / 0.45)',
}

const BOXES: Record<string, CSSProperties> = {
  a: { left: '8%', top: '0%', width: '84%', height: '15%' },
  b: { left: '85%', top: '8%', width: '15%', height: '38%' },
  c: { left: '85%', top: '54%', width: '15%', height: '38%' },
  d: { left: '8%', top: '85%', width: '84%', height: '15%' },
  e: { left: '0%', top: '54%', width: '15%', height: '38%' },
  f: { left: '0%', top: '8%', width: '15%', height: '38%' },
  g: { left: '8%', top: '42.5%', width: '84%', height: '15%' },
}

const HORIZONTAL = 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)'
const VERTICAL = 'polygon(0 8%, 50% 0, 100% 8%, 100% 92%, 50% 100%, 0 92%)'

interface SegmentDigitProps {
  char: string
  state?: SegmentState
  /** 字形高度（px），宽度按 0.56 的比例推出 */
  height?: number
  className?: string
}

export default function SegmentDigit({
  char,
  state = 'lit',
  height = 56,
  className = '',
}: SegmentDigitProps) {
  const active = DIGIT_SEGMENTS[char]

  if (!active) {
    return (
      <span
        aria-hidden="true"
        className={`readout inline-block text-center ${className}`}
        style={{
          height,
          lineHeight: `${height}px`,
          fontSize: Math.round(height * 0.46),
          color: FILL[state],
        }}
      >
        {char}
      </span>
    )
  }

  const width = Math.round(height * 0.56)
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block ${className}`}
      style={{ width, height }}
    >
      {Object.keys(BOXES).map((segment) => {
        const on = active.includes(segment)
        return (
          <i
            key={segment}
            style={{
              position: 'absolute',
              ...BOXES[segment],
              background: on ? FILL[state] : 'rgb(var(--c-lit-ghost))',
              boxShadow: on ? GLOW[state] : 'none',
              clipPath: segment === 'a' || segment === 'd' || segment === 'g' ? HORIZONTAL : VERTICAL,
              borderRadius: 1,
            }}
          />
        )
      })}
    </span>
  )
}
