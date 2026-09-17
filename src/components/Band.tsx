import type { ReactNode } from 'react'

/**
 * 导视带：设置页的基元。
 * 左边是名字与一行等宽小签，右边是**当前值**（大号读数或状态灯）。
 * 需要改的时候，同一条带就地展开控制区，值在右列即时更新。
 */
interface BandProps {
  label: string
  /** 等宽小签，例如 FONT SIZE / REMINDER / IRREVERSIBLE */
  kicker?: string
  /** 右列：字符串走大号读数，status 走状态灯 */
  value?: string
  tone?: 'default' | 'done' | 'alert' | 'dim'
  hint?: string
  control?: ReactNode
  action?: ReactNode
  children?: ReactNode
  open?: boolean
  onToggle?: () => void
  danger?: boolean
}

const TONE: Record<string, string> = {
  default: 'text-fg',
  done: 'text-done',
  alert: 'text-alert',
  dim: 'text-dim',
}

export default function Band({
  label,
  kicker,
  value,
  tone = 'default',
  hint,
  control,
  action,
  children,
  open,
  onToggle,
  danger,
}: BandProps) {
  const expandable = typeof onToggle === 'function'
  return (
    <div
      className={`border bg-panel ${danger ? 'border-alert/45' : 'border-hairline'}`}
      style={{ borderRadius: 'var(--c-radius)' }}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        {expandable ? (
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span className="block text-[15px] leading-tight text-fg">{label}</span>
            {kicker ? (
              <span className="readout mt-1 block text-[10px] tracking-[0.18em] text-dim">
                {kicker}
              </span>
            ) : null}
            {hint ? <span className="mt-0.5 block text-[11px] text-dim">{hint}</span> : null}
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <span className="block text-[15px] leading-tight text-fg">{label}</span>
            {kicker ? (
              <span className="readout mt-1 block text-[10px] tracking-[0.18em] text-dim">
                {kicker}
              </span>
            ) : null}
            {hint ? <span className="mt-0.5 block text-[11px] text-dim">{hint}</span> : null}
          </div>
        )}

        <div className="shrink-0 text-right">
          {value ? (
            <span className={`readout block text-[24px] leading-none ${TONE[tone]}`}>{value}</span>
          ) : null}
          {control}
          {action}
        </div>
      </div>
      {children && open ? (
        <div className="border-t border-hairline px-3.5 py-3">{children}</div>
      ) : null}
    </div>
  )
}
