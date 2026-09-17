import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAppStore } from './store/useAppStore'

const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DesignPage = lazy(() => import('./pages/DesignPage'))

export default function App() {
  const status = useAppStore((s) => s.status)
  const error = useAppStore((s) => s.error)
  const init = useAppStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
        <p className="font-song text-lg text-ink-faint">正在打开书箱…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
        <p className="font-song text-lg text-ink">本地数据库打开失败</p>
        <p className="text-sm text-ink-faint">{error}</p>
        <p className="text-sm text-ink-faint">
          请确认浏览器未处于无痕模式，并允许本站使用本地存储。
        </p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
          <p className="font-song text-lg text-ink-faint">正在展开…</p>
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/review" replace />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/player/:workId" element={<PlayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/design" element={<DesignPage />} />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
