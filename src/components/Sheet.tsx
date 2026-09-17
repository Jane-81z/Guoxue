import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { IconClose } from './Icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/** 全屏浮层：用于统计面板、全篇原文编辑等重内容 */
export default function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-paper"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="flex items-center gap-2 border-b border-paper-line px-4 py-3 pt-safe">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate font-song text-lg text-ink">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-xs text-ink-faint">{subtitle}</p> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="关闭"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--c-radius)] text-ink-soft active:bg-paper-deep"
          onClick={onClose}
        >
          <IconClose />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? (
        <footer className="border-t border-paper-line bg-paper-soft px-4 py-3 pb-safe">
          {footer}
        </footer>
      ) : (
        <div className="pb-safe" />
      )}
    </div>
  )
}
