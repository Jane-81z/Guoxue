/**
 * 视觉世界：日课刻度（seven-segment instrument）。
 * 骰子发出的挑战牌 signals-instruments-seven-segment-alarm-clock，
 * 由使用者点名选中（优先于 ASSIGNED INDEX 3）。种子 key cf51c6de。
 *
 * 这是一次「替换」而不是「增加」：被替换掉的世界不再作为可选项留在代码里，
 * 否则两套观感会互相稀释，DESIGN.md 也会与实现不一致。
 *
 * 颜色以 "R G B" 写入 CSS 变量；`--c-*` 是这个世界自己的语义名，
 * 同时把旧名字（paper / ink / cinnabar / jade）按角色映射过去，
 * 让尚未重写的页面自动进入同一个世界。
 */
export interface ThemeDirection {
  id: string
  name: string
  tagline: string
  description: string
  /** 浏览器主题色（移动端状态栏） */
  themeColor: string
  dark: boolean
  vars: Record<string, string>
}

const SANS =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const MONO = '"SF Mono", "JetBrains Mono", Consolas, "Liberation Mono", ui-monospace, monospace'

export const FONT_SANS = SANS
export const FONT_MONO = MONO

const CORE: Record<string, string> = {
  '--c-ground': '11 13 16',
  '--c-panel': '16 19 23',
  '--c-well': '8 9 11',
  '--c-hairline': '35 38 43',
  '--c-fg': '226 220 208',
  '--c-fg-soft': '186 179 166',
  '--c-dim': '146 138 126',
  '--c-ghost': '132 124 112',
  '--c-lit': '255 46 31',
  '--c-lit-soft': '255 110 92',
  '--c-lit-ghost': '58 27 24',
  '--c-done': '52 208 122',
  '--c-done-ghost': '30 62 45',
  '--c-alert': '255 176 32',
}

const VARS: Record<string, string> = {
  ...CORE,
  '--c-paper': CORE['--c-ground'],
  '--c-paper-soft': CORE['--c-panel'],
  '--c-paper-deep': CORE['--c-well'],
  '--c-paper-line': CORE['--c-hairline'],
  '--c-ink': CORE['--c-fg'],
  '--c-ink-soft': CORE['--c-fg-soft'],
  '--c-ink-faint': CORE['--c-dim'],
  '--c-ink-pale': CORE['--c-ghost'],
  '--c-accent': CORE['--c-lit'],
  '--c-accent-soft': CORE['--c-lit-soft'],
  '--c-accent-pale': CORE['--c-lit-ghost'],
  '--c-jade': CORE['--c-done'],
  '--c-jade-pale': CORE['--c-done-ghost'],
  '--c-radius': '2px',
  '--c-radius-sm': '2px',
  '--c-font-body': SANS,
  '--c-font-digit': MONO,
}

export const DEFAULT_THEME_ID = 'kedu'

export const THEMES: ThemeDirection[] = [
  {
    id: 'kedu',
    name: '日课刻度',
    tagline: '今天的任务是一列固定格子',
    description:
      '哑光近黑地，发光段红表示当前、绿表示已背、琥珀表示逾期，未点亮的段是刻意设计的幽灵态。数字用等宽读数，中文用方块无衬线，圆角一律 2px。',
    themeColor: '#0B0D10',
    dark: true,
    vars: VARS,
  },
]

export function findTheme(id: string | undefined): ThemeDirection {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function themeStyle(theme: ThemeDirection): Record<string, string> {
  return theme.vars
}
