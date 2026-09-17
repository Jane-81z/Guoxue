import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { applyTheme } from './theme/apply'

// 首屏之前先套用上次选择的视觉方向，避免闪一下默认配色
applyTheme()

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = (await navigator.storage.persisted?.()) ?? false
      if (!already) await navigator.storage.persist()
    }
  } catch {
    // 忽略：部分浏览器不支持
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('缺少 #root 节点')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

void requestPersistentStorage()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void import('virtual:pwa-register')
      .then(({ registerSW }) => registerSW({ immediate: true }))
      .catch(() => undefined)
  })
}
