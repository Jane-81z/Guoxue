---
version: 1
slug: "src-pages-librarypage-tsx"
primary_target: "src/pages/LibraryPage.tsx"
related_targets: ["src/index.css"]
---

# 篇目页

Scope：`src/pages/LibraryPage.tsx` 为一个 surface；它沿用已定的世界「日课刻度」，只决定结构。
Visitor mode：Operate — 查看一篇的全部段落，并就地改原文、注音、注释。
Job：一屏只看当前这一篇；看与改是同一个动作；切篇要快；每一篇都有可深链的地址。
Constraints：一个人用、手机竖屏单手；功能一项不增不减（含搜索、筛选、录音、要背开关、重置、删除）。

## Direction contract

THESIS：篇目页是一张平的卡片，一次只摊开一篇——**不要叠层**。卡头是篇名与朝代作者，卡内是这一篇的段码摘要与段落行，段落就地可改；它拒绝把篇目做成无限卡片流。

OWN-WORLD：沿用世界令牌。卡是 `panel`（1px 发丝线、2px 圆角、无阴影）；段码表示「要背的段里有几段已背」；段落行是井式底（well）；切换篇目用卡头右侧的等宽读数 `第 03 / 共 05 篇` 加前后键；段号等宽读数；录音与要背开关用段码语言，不用对勾徽章。

STORY：进来就看见当前这一篇的完整样子，哪几段背过了、哪几段要背、哪几段有录音；改一个字不会被切走；前后键一按就换篇；深链能把任意一篇直接送到手上。

FIRST VIEWPORT：390×844：顶部页头保留全局入口（「篇目」抽屉 = 搜索与筛选、以及「+ 导入」）；下方一张平卡——卡头篇名（20px）+ 朝代作者 + 段码行；卡内段落行（井式底、等宽段号、要背/录音状态）就地可改。

已知的、有理由的偏离：翻篇控件没有放在页头，而是放在**卡头右侧**（`第 03 / 共 05 篇` + 前后键）。理由：这个读数描述的是「正在看的这一篇」，它属于被翻的那个对象；页头留给全局入口。段落的低频操作（重置进度、删除录音、删除该段）也从行内移进了展开后的编辑面板——一行常态只留「播放 / 录音 / 编辑 / 要背」四个键，避免每行七键把正文压成工具栏。

FORM：目录世界 medium-native-hypercard-stack-shoebox 的融合——借它「一卡一篇、浏览即编辑、每张卡可深链」的结构纪律，去掉它的叠层与手绘边框语汇（使用者明确要求：不要叠层，只显示当前篇目）。种子 key 960b2ce8。这是骰子发出的挑战牌，由使用者点名选中并做了删改。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
