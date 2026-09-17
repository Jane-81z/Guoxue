import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export default function Dialog({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      window.clearTimeout(focusTimer)
    }
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:pb-10">
      <div
        className="animate-rise-in w-full max-w-md rounded-[var(--c-radius)] border border-paper-line bg-paper-soft p-5 shadow-paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="font-song text-lg text-ink">
          {title}
        </h2>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
