# 国学背诵（Guoxue Recitation）

一个纯前端的国学文字背诵 App：一套 React 代码同时充当网页版和 iPhone 可安装应用（PWA）。所有数据存在浏览器本地 IndexedDB，无服务器、无账号、零运行成本。

## 功能

**导入与分篇**

- 粘贴文本导入，一行即一段；可逐段勾选「要背 / 只读」，可合并相邻行
- 篇目页按篇分组展示全部段落，可搜索、筛选（待复习 / 已掌握 / 有录音）
- 单段编辑保留录音与复习进度；整篇重写按行文本自动对应旧段落，删除带进度或录音的段落前会明确提示

**注音与注释**

- `pinyin-pro` 离线逐字注音，多音字按上下文取音（如「论语」lún yǔ / 「讨论」lùn）
- 卡片页可按字人工修正拼音，修正优先于自动注音；每段可写注释

**间隔重复**

- SM-2 简化版：四档评分（完全不会 / 吃力 / 略有卡顿 / 流畅）映射 q=0/3/4/5
- 第 1 次 1 天、第 2 次 6 天、之后 `interval × ease`；ease 夹在 1.3–2.8，`q<3` 时重置
- 熟练度 0–100 分 = 间隔因子（60）+ 稳定度因子（25）+ 最近三次评分（15）
- 复习页整段隐藏原文，一键显全文；跳过不影响排期；当日到期卡片评完自动打卡
- 当天已完成的篇目仍留在读数板并标成「已完成」，刷新页面也不会丢，直到第二天重新开一局

**录音与播放**

- 段级上传录音（支持多选批量按顺序对应），音频以 Blob 存在 IndexedDB
- 播放页一段一首：连续播放、上一首/下一首、单段循环/整篇循环、0.5×–1.5× 变速、复读 N 遍、记忆播放位置
- 复习页不播放录音；录音播放集中在播放页与全局迷你播放器

**统计、提醒与备份**

- 统计面板：今日待复习/已完成、待复习总数、已掌握、已背篇目、累计复习次数、熟练度分布、各篇熟练度、26 周复习热力图
- 每日提醒：设置里导出 `.ics`（每天固定时间循环 + VALARM），导入 iPhone 日历后长期有效
- 备份：JSON（全部文字数据与进度）+ 录音 ZIP（按 passageId 回挂），换机时先导数据再导录音
- 存储：启动即申请 `navigator.storage.persist()`，设置页可查看占用量

**视觉方向**

- 内置七种设计方向：默认「日课刻度」，另有宣纸朱砂 / 靛青竹简 / 夜墨金 / 素笺靛蓝 / 敦煌赭石 / 焦墨高对比，全部以 CSS 变量驱动，切换即时生效
- 「设置 → 视觉世界 → 切换」进入 `/design`，每一套方向都带真实读数板小样；也可以「随机抽一个」

## 技术栈

Vite 6 · React 18 · TypeScript · Tailwind CSS 3 · Zustand · Dexie（IndexedDB）· pinyin-pro · JSZip · vite-plugin-pwa

## 本地开发

```bash
npm install
npm run dev        # 本地开发
npm run test       # 62 项纯函数单测（Vitest）
npm run e2e        # 9 条端到端回归（Playwright + 本机 Chrome，端口 5173）
npm run build      # 生产构建（含 Service Worker）
npm run preview    # 预览构建产物
npm run icons      # 重新生成 PWA 图标

### 端到端回归覆盖什么

`e2e/flow.spec.ts` 走真实交互路径，不用内部 API 造数据：

- **闭环**：粘贴导入 → 逐段取消「要背」→ 今日读数板（`DONE / DUE` + 预计用时）→ 长按进入背诵态 → 点亮原文（校验 ruby 注音）→ 四档评分 → 自动打卡
- **跳过**：跳过只换卡、不写排期，计数不变
- **篇目页**：单卡、前后翻篇写进 `?work=` 深链、刷新后仍是同一篇、「篇目」抽屉可跳转；段落行常态只留四个操作键，删除与重置在编辑面板里
- **设置页**：导视带右列就是当前值；展开后能改；改完刷新仍在（写进 IndexedDB）

`e2e/layout.spec.ts` 把点名过的版式约定钉成断言：长按键贴底栏且比条目矮、四把评分键钉在底栏上方且完整可见、长原文只保留一个滚动手势且滚到底不被键挡住、390 与 1440 都不横向溢出。
```

## 部署

仓库根目录已含 `vercel.json`（SPA 重写 + Service Worker 缓存头）。把仓库连到 Vercel 即可自动构建部署，产物是纯静态站，自带 HTTPS——PWA 必须 HTTPS 才能在 iPhone 上安装。

上线后在 iPhone Safari 打开站点 → 分享 → 添加到主屏幕，即可全屏离线使用。

## 数据与隐私

所有数据（原文、拼音、注释、录音、复习记录）都只存在当前设备的浏览器里，不上传任何服务器。iOS 对未安装到主屏的站点可能在长期不用后清理本地数据，因此建议：

1. 添加到主屏幕
2. 在设置页开启持久化存储
3. 定期导出 JSON 与录音 ZIP 备份

## Impeccable（界面设计插件）

本项目已安装 [Impeccable](https://impeccable.style) 4.3.1（Renaissance Geek Inc 出品的 UI 设计 skill，含 25 个设计命令与 61 条确定性检测规则）。

安装位置：

- 项目级：`.codex/skills/impeccable`（含 `scripts/impeccable.cmd` 启动器与引擎缓存）
- 用户级：`%USERPROFILE%\.codex\skills\impeccable`（所有项目可用）
- 钩子：`.codex/hooks.json`（编辑后检查 UI 改动、回合结束做设计深检）

官方 `npx impeccable install` 在本机下载 skill bundle 时会超时，因此改用官方 `link` 命令的等价做法：克隆 `github.com/pbakaus/impeccable` 后把 `.agents/skills/impeccable` 复制到上述目录。引擎二进制已按官方 sha256 校验流程下载，`impeccable doctor` 报告无 drift。

常用命令（在项目根目录执行 `.codex/skills/impeccable/scripts/impeccable.cmd <verb>`）：

| 命令 | 用途 |
| --- | --- |
| `context` | 载入 PRODUCT.md / DESIGN.md / 当前面 brief，每个会话跑一次 |
| `detect [路径]` | 扫描 UI 反模式（`--json` 输出结构化结果） |
| `concept-seed --scope direction` | **投骰子**：随机发牌若干设计方向，含重新掷骰寄存器 |
| `serve-question --start` | 打开可视化决策页，让用户锁定一个方向 |

「投骰子选页面」的完整流程是：`/impeccable init` 写 PRODUCT.md → `concept-seed` 掷出方向 → `serve-question` 生成决策页 → 用户锁定；元素级变体用 `/impeccable generate <count> <direction> variants of <element>`。
