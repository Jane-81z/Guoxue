# 设置页

Scope：`src/pages/SettingsPage.tsx` 为一个 surface；它沿用已定的世界「日课刻度」，只决定结构。
Visitor mode：Operate — 来确认「现在是什么状态」，以及改一个值。
Job：不点进去就知道每一项当前的值；改连续值时有即时反馈；危险操作一眼可辨。
Constraints：一个人用、手机竖屏单手；功能一项不增不减；数据仍全在本地。

## Direction contract

THESIS：设置页是一块导视牌，不是一列设置。每条是一个整幅横带，左边是名字，右边是**当前值的大号读数**；它拒绝把值藏进控件里。

OWN-WORLD：沿用世界令牌（地面 #0B0D10 / 面板 #101317 / 发丝线 #23262B / 发光红 #FF2E1F / 完成绿 #34D07A / 逾期琥珀 #FFB020）。新增一个基元：band —— 整幅横带，左标签 + 右大号等宽读数，1px 发丝线，圆角 2px；开关类用段码式小键，连续值用刻度滑杆配同一个右列读数。

STORY：扫一眼右列就知道字号多大、行高多少、速度多快、提醒几点、备份开没开；要改就在同一行上改，值即时变化；清空数据单独一条琥珀边，永远不和别的项混在一起。

FIRST VIEWPORT：390×844：顶部页头（设置 · 版本）；下方一列横带，每条 64–72px 高——正文字号 `1.00×`、正文行高 `1.90`、背诵速度 `150`、每日提醒 `20:00`、持久化 `ON`（绿）；最后一条琥珀边的清空数据。横带之间只用 8px 间距与发丝线，不用卡片。

FORM：目录世界 wayfinding-cartography-signage-terminal-yellow-wayfinding 的融合——只取它的排布与层级纪律（严格边距、右侧纪念碑式数值、危险项单独成带），不取它的饱和黄。种子 key 6fd50e1f。这是骰子发出的挑战牌，由使用者点名选中。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
