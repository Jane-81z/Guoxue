---
name: 国学背诵
description: 以篇为单位的本地国学背诵仪表，日课刻度视觉世界
colors:
  instrument-ground: "#0B0D10"
  instrument-panel: "#101317"
  instrument-well: "#08090B"
  hairline: "#23262B"
  text-primary: "#E2DCD0"
  text-secondary: "#BAB3A6"
  text-dim: "#928A7E"
  text-ghost: "#847C70"
  current-segment: "#FF2E1F"
  current-segment-soft: "#FF6E5C"
  current-segment-ghost: "#3A1B18"
  complete-segment: "#34D07A"
  complete-segment-ghost: "#1E3E2D"
  alert-amber: "#FFB020"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "54px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "0.02em"
  label:
    fontFamily: '"SF Mono", "JetBrains Mono", Consolas, ui-monospace, monospace'
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.2em"
rounded:
  instrument: "2px"
  segment: "1px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.instrument-ground}"
    rounded: "{rounded.instrument}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.instrument}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.instrument-ground}"
    textColor: "{colors.current-segment}"
    rounded: "{rounded.instrument}"
    padding: "8px 12px"
  field:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.instrument}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.instrument}"
    padding: "4px 12px"
  cellrow:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.instrument}"
    padding: "12px 14px"
---

# Design System: 国学背诵

## Overview

**Creative North Star: "日课刻度"**

这是一台只服务背诵的仪表。今天到期的每一篇占一个固定格子，已背的点亮，未背的保持刻意设计过的熄灭态；顶部读数是当天进度，底部长按键是一次“拉动”，把界面从读数板切成背诵态。它拒绝做成卡片流、进度环或连续天数徽章。

世界由七段数码管与记分牌的材料来源长出：哑光近黑地、发丝线、硬边发光段、等宽读数。中文用方块无衬线，数字用等宽，圆角压到 2px。状态由段承担，而不是由对勾、徽章或彩色进度条承担。

这是一个被替换过一次的世界：被替换掉的纸墨方向不再作为可选项留在代码里，否则两套观感会互相稀释。世界只有一套，记录在 `设置 → 视觉世界 → 查看方向`。

**Key Characteristics:**

- 以篇为单位的固定格子，而不是无限卡片流。
- 缺席是设计对象：未点亮的段仍有轮廓。
- 数字用大号等宽读数承担重量。
- 状态一律由段、边框与明暗表达。
- 原文是屏幕中心，操作层贴着底部安全区。

## Colors

「日课刻度」是一套克制的仪表色：近黑地承载长时间阅读，红只表示当前，绿只表示完成，琥珀只表示逾期。

### Primary

- **Current Segment Red** (#FF2E1F): 当前段、长按键填充、当前格边框与需要立刻看见的行动点。
- **Complete Segment Green** (#34D07A): 已完成段、已打卡读数、完成态格子边框。

### Secondary

- **Alert Amber** (#FFB020): 只用于逾期与需要注意的时间状态，不用作普通装饰。

### Neutral

- **Instrument Ground** (#0B0D10): 页面地面、顶部与底部栏底色。
- **Instrument Panel** (#101317): 面板、格子、控件与浮层的表面。
- **Instrument Well** (#08090B): 凹陷阅读区、输入区、原文隐藏态。
- **Hairline** (#23262B): 1px 分隔线、面板边框、格子边界。
- **Text Primary** (#E2DCD0): 正文与关键标题。
- **Text Secondary** (#BAB3A6): 次级信息、说明文字。
- **Text Dim** (#928A7E): 读数标签、元数据。
- **Text Ghost** (#847C70): 熄灭态、未点亮的段与不可用提示。

### Named Rules

**The One Lit Segment Rule.** 同一时刻只让一个“当前”状态使用高亮红；已完成用绿，逾期用琥珀，三者不互相抢焦点。

**The No Badge Rule.** 进度与状态优先由段码、边框和读数表达；不要新增对勾徽章、进度环或连续天数胶囊。

## Typography

**Display Font:** 系统中文方块无衬线（PingFang SC / Microsoft YaHei）
**Body Font:** 系统中文方块无衬线（这个世界的显示字不是衬线体）
**Label / Mono Font:** SF Mono / JetBrains Mono / Consolas

**Character:** 中文保持安静、端正、可长时间阅读；数字像仪表读数，紧、准确、有重量。两者不混用装饰字体。

### Hierarchy

- **Display** (400, 44–54px, 1): 今日进度、剩余分钟、完成读数。只在比例读数与关键格子标题使用。
- **Headline** (400, 19–20px, 1.2): 页面标题、篇名、全屏面板标题。
- **Title** (400, 15–17px, 1.3): 格子标题、段落正文、主要操作标签。
- **Body** (400, 17px, 1.9): 导入原文、篇目正文、复习原文。正文行宽控制在 65–75ch；移动端由容器决定。
- **Label** (400, 9–11px, 0.16–0.24em): 读数说明、段号、状态标签与英文仪表字。

### Named Rules

**The Readout Rule.** 所有会变化的数字使用等宽与表格数字；不要用比例字体显示进度、分钟、段号或时间。

## Layout

移动端以 390×844 为主场景，内容列最大宽度 672px（`max-w-2xl`），左右安全边距 16px。顶部是粘性页头，底部是 60px 导航；正文为它们预留 120px 以上的底部空间，并叠加 `env(safe-area-inset-*)`。

页面节奏是“读数 → 任务格 → 操作”。读数区使用大号数字；任务格是 68px 左右的固定行，不因内容长短跳动；操作键以 2×2 网格或单个长按键钉在底栏上方。宽屏仍保持单列工作台，不把信息摊成多列仪表盘。

行距与字号由 `--body-font-scale`、`--body-line-height` 驱动，默认 1.9；竖排正文使用 `writing-mode: vertical-rl`，横向滚动而不是缩小文字。

## Elevation & Depth

这套系统以 tonal layering 为主，不用漂浮卡片。地面、面板、凹井三层颜色就承担了层级；边框是 1px 发丝线，格子当前态用内侧 2px 光条，而不是外投阴影。

阴影只属于临时浮层：底部播放器、Toast、Dialog 使用带偏移和柔化的大范围阴影，表示它们暂时离开纸面。普通内容区没有阴影。

### Shadow Vocabulary

- **paper** (`0 1px 2px rgba(35,33,30,0.04), 0 8px 24px -16px rgba(35,33,30,0.28)`): 播放器、Dialog、Toast 等浮层。

### Named Rules

**The Flat-By-Default Rule.** 内容区默认平铺；阴影只在元素离开纸面或成为临时浮层时出现。

## Shapes

圆角体系只有两级：面板、格子、按钮、输入框、浮层一律 2px；段码与进度条 1px。圆形只保留给设置里的开关滑块，不用于状态徽章、图标按钮或播放器外壳。

边框是 1px 发丝线；当前格使用内侧 2px 光条，不使用彩色左边框。图标使用同一套 1.6–1.8px 线性 SVG，不使用 emoji 代替图标。

## Components

### Buttons

- **Shape:** 2px 圆角，紧凑内边距（8px 12px）。
- **Primary:** 墨色底、纸色字；用于确认、保存、导入。
- **Ghost:** 面板底、发丝线边框、次级文字色；用于取消、切换、次级操作。
- **Danger:** 地面底、朱砂字与 35% 朱砂边框；只用于删除、清空、不可恢复操作。
- **Focus:** 2px 当前色外轮廓，偏移 2px；键盘可见，触摸不显示。

### Chips

- **Style:** 2px 圆角，面板底，1px 发丝线；选中态使用文字色实底。
- **State:** 用于筛选、状态、段落操作；不承担页面级导航。

### Cards / Containers

- **Corner Style:** 2px。
- **Background:** 页面用 ground，面板用 panel，阅读区用 well。
- **Shadow Strategy:** 默认无阴影，参考 Elevation & Depth。
- **Border:** 1px hairline；当前格与完成格以同色低透明度改变边框。
- **Internal Padding:** 12–16px，紧密但不挤压正文。

### Inputs / Fields

- **Style:** 面板底、1px 发丝线、2px 圆角；移动端字号固定 16px，避免 iOS 聚焦缩放。
- **Focus:** 边框转向更亮的文字色，并保留键盘外轮廓。
- **Disabled:** 降低透明度但不改变布局。

### Navigation

- **Style:** 固定底部，4 个标签：复习 / 篇目 / 播放 / 设置。5×5 线性 SVG 图标在上，11px 标签在下。
- **Default / Active:** 默认次级文字色，当前页文字色加粗；激活不弹出新容器。
- **Mobile Treatment:** 始终保留安全区内边距；迷你播放器出现时，操作键整体上移。

### Segment Bar

Three stacked 4px segments. Lit, done, alert and unlit are four distinct states; the unlit state is a designed ghost rather than an empty space.

### Hold Key

The single-entry control for starting a recitation session. A 450ms hold fills the key from left to right; keyboard Enter or Space is equivalent for accessibility.

### World Record

一个只读的方向记录页（`/design`）：当前世界的名称、一句话主张、六个令牌色片，以及这个世界从挑战牌那里留下的四条纪律。它不是选择器——更换世界是 new-work 的决策，不是使用者的日常开关。

## Do's and Don'ts

### Do:

- **Do** keep the fixed work cells in the day board after they are completed; a completed day should still show its record.
- **Do** use red for current, green for complete, amber for overdue, and the ghost tone for absent.
- **Do** keep the 2px surface radius and 1px segment radius in every new component.
- **Do** keep core actions within one-hand reach at the bottom, above the nav and mini-player.
- **Do** preserve keyboard focus, 16px mobile inputs, safe-area padding and reduced-motion behavior.

### Don't:

- **Don't** introduce the hero-metric template, progress rings, streak badges or card stacks.
- **Don't** use gradient text, decorative glass, hard offset shadows or colored 2px+ side borders.
- **Don't** use emoji as the icon system; draw or reuse the linear SVG set.
- **Don't** reintroduce a second visual world as a selectable skin; a world is replaced, never stacked.
- **Don't** shrink long Chinese text to fit; change the container or let it scroll.
