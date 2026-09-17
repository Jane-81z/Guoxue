---
version: 1
slug: "src-pages-reviewpage-tsx"
primary_target: "src/pages/ReviewPage.tsx"
related_targets: ["src/index.css","src/components/Layout.tsx"]
---

# 今日复习

Scope：`src/pages/ReviewPage.tsx` 为第一张要建的 surface；这个世界的规则同时约束导航、设置与后续页面。
Visitor mode：Operate — 使用者来完成一件任务：把今天到期的段落背掉并打卡。
Job：打开就知道今天还剩几段、大约几分钟；长按一次进入背诵；评完自动打卡。
Constraints：一人使用，数据只在本地；复习页不放录音；字号、行高、竖排仍是既有能力。

## Direction contract

THESIS：这块屏幕是一台只服务背诵的仪表。今天的任务是一列固定格子，已背的点亮、未背的保持刻意设计过的熄灭态；它拒绝做成卡片流、进度环或连续天数徽章。

OWN-WORLD：哑光近黑地 #0B0D10、面板 #101317、发丝线 #23262B；发光段红 #FF2E1F 表示当前，绿 #34D07A 表示已完成，琥珀 #FFB020 表示逾期，未点亮的段是有意设计的幽灵态 #2A1A18。方块无衬线中文 + 等宽数字，圆角一律 2px，状态切换是瞬时换段而不是过渡动画。

STORY：使用者一眼看到剩余段数与预计分钟数，长按开始，逐段点亮；最后一次评分后整列转绿并显示已打卡。

FIRST VIEWPORT：390×844 一屏：顶部一行日期与小字标签，下面是读数区（大号 `2/5` 已完成/到期，右侧 `≈06` 分钟，均带幽灵位）；中部一列固定格子，每格一篇（篇名、段数、预计分钟、逾期天数，右侧三段式段码）；底部一枚长按键「长按开始背诵」，按住时填充扫过。

FORM：目录世界 signals-instruments-seven-segment-alarm-clock 的融合；这是骰子发出的挑战牌，由使用者点名选中，优先于 ASSIGNED INDEX 3。种子 key cf51c6de。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 本轮新增的产品事实

预计用时：每段 = 有录音则按录音时长 × 1.15，无录音则按字数 ÷ 背诵速度（默认 150 字/分钟），再加 8 秒评分开销；今日合计以 `≈NN MIN` 显示。背诵速度在设置里可调（120–200 字/分钟），因为它直接决定这个数字是否可信。
