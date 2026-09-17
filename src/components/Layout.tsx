import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { IconLibrary, IconPlay, IconReview, IconSettings } from './Icons'
import MiniPlayer from './MiniPlayer'
import Toast from './Toast'
import { useAppStore } from '../store/useAppStore'
import { applyTheme } from '../theme/apply'

const TABS = [
  { to: '/review', label: '复习', Icon: IconReview },
  { to: '/library', label: '篇目', Icon: IconLibrary },
  { to: '/player', label: '播放', Icon: IconPlay },
  { to: '/settings', label: '设置', Icon: IconSettings },
]

export default function Layout() {
  const fontScale = useAppStore((s) => s.settings.fontScale)
  const lineHeight = useAppStore((s) => s.settings.lineHeight)
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-paper"
      style={
        {
          '--body-font-scale': String(fontScale),
          '--body-line-height': String(lineHeight),
        } as CSSProperties
      }
    >
      <main className="flex-1 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <MiniPlayer />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-line bg-paper pb-safe">
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                    isActive ? 'text-ink' : 'text-ink-faint'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 ${isActive ? '' : 'opacity-80'}`} />
                    <span className={isActive ? 'font-medium' : ''}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Toast />
    </div>
  )
}
