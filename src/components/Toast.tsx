import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export default function Toast() {
  const toast = useAppStore((s) => s.toast)
  const dismiss = useAppStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(dismiss, 2800)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  if (!toast) return null
  const tone =
    toast.tone === 'error'
      ? 'border-cinnabar/40 text-cinnabar'
      : toast.tone === 'success'
        ? 'border-jade/40 text-jade'
        : 'border-paper-line text-ink-soft'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-[80] flex justify-center px-6">
      <div
        key={toast.id}
        role={toast.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        className={`animate-rise-in max-w-sm rounded-[var(--c-radius)] border bg-paper-soft px-4 py-2 text-center text-sm ${tone}`}
      >
        {toast.message}
      </div>
    </div>
  )
}
