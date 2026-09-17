import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevron } from './Icons'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** 显示返回按钮，默认返回上一层 */
  back?: boolean
  onBack?: () => void
}

export default function PageHeader({ title, subtitle, actions, back, onBack }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-paper-line bg-paper pt-safe">
      <div className="flex items-center gap-2 px-4 py-3">
        {back ? (
          <button
            type="button"
            aria-label="返回"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] text-ink-soft active:bg-paper-deep"
            onClick={() => (onBack ? onBack() : navigate(-1))}
          >
            <IconChevron className="h-5 w-5 rotate-180" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-song text-xl text-ink">{title}</h1>
          {subtitle ? <div className="mt-0.5 truncate text-xs text-ink-faint">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
