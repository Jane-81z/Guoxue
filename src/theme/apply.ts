import { DEFAULT_THEME_ID, findTheme, type ThemeDirection } from './themes'
import type { CSSProperties } from 'react'

export const THEME_STORAGE_KEY = 'guoxue:theme'

/** 把主题变量写到 <html>，整套 Tailwind 颜色随之切换 */
export function applyTheme(id?: string): ThemeDirection {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
  const theme = findTheme(id ?? stored ?? DEFAULT_THEME_ID)
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.themeColor)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id)
  } catch {
    // 隐私模式下可能不可写，忽略
  }
  return theme
}

export function themeVars(theme: ThemeDirection): CSSProperties {
  return theme.vars as unknown as CSSProperties
}
