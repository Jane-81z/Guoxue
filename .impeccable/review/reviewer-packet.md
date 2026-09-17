# Finish review packet

**You are a REVIEWER. Do not create, edit, move or delete any file in this repository.** Read-only inspection plus a written verdict. If you believe a fix is needed, describe it; do not apply it.

## Your role

You are the shipped Impeccable **finish reviewer**. Read your own shipped definitions first (this harness does not auto-load them):

1. `C:\Users\cheng\.codex\skills\impeccable\agents\impeccable_finish_reviewer.toml`
2. `C:\Users\cheng\.codex\skills\impeccable\reference\craft-floor.md`

Then perform the review exactly as those files define it, and return the five contract sections plus an explicit `disposition` word: `ship` | `fix` | `rebuild` | `recapture`.

## Original request (Chinese, user's own words)

国学文字背诵 App（PWA）。用 impeccable 开始设计（骰子给出方向选择页）；用户点名选中挑战牌 `signals-instruments-seven-segment-alarm-clock`（世界名「日课刻度」）。随后追加四条要求：

1. 显示「预计需要多少分钟」。
2. 「长按开始背诵」按键固定在底栏上方，高度要比背诵条目矮。
3. 背诵态的四把评分键也钉在底栏上方，形状不变。
4. 长原文是否滚动 → 收敛为单一滚动手势。

## Confirmed product answers

只有一个人用（本人）；核心机制是以「篇」为单位安排今天该背哪几篇并打卡；永远不要账号/云同步；本地优先，数据只在 IndexedDB。

## Artifact

- The fully committed first surface: `src\pages\ReviewPage.tsx` (今日复习)
- Direction contract (the thing you audit against): `.impeccable\surfaces\src-pages-reviewpage-tsx.md`
- Product truth: `PRODUCT.md`
- Design system as built: `DESIGN.md`, `.impeccable\design.json`
- Same world's system: `src\index.css` (panel / readout / seg / cellrow / holdkey / keypad), `src\theme\themes.ts`, `src\lib\estimate.ts` (+11 unit tests), `src\pages\LibraryPage.tsx`, `src\pages\SettingsPage.tsx`, `src\pages\DesignPage.tsx`

## Build path

**code-led.** No approved generated comp exists (this session has no image generation). In the approved-comp slot, use these as **critique references only**:

- code-rendered schematic of the chosen direction's first surface: `.impeccable\mocks\decision\seven-segment.png`
- catalog inspiration (labeled craft bar, not a mockup to copy): `https://impeccable.style/worlds/cards/signals-instruments-seven-segment-alarm-clock-hero.webp`

Do **not** treat either as an approval.

## Screenshots (judge from these files; the preview server is stopped)

`.impeccable\review\mobile.png` (390×844 @2x, full page)
`.impeccable\review\desktop.png` (1440×900, full page — required viewport)
`.impeccable\review\review-reciting.png` (背诵态，评分键钉底)
`.impeccable\review\review-revealed.png` (点亮原文)
`.impeccable\review\review-long-scrolled.png` (长原文滚到底)
`.impeccable\review\library-mobile.png` / `player-mobile.png` / `settings-mobile.png` (780×3678 full page) / `import-mobile.png` / `library-desktop.png` (1440×900)

## Measured evidence (headless Chrome DOM rects; verified this session)

- 390×844: zero horizontal overflow on `/review`, `/library`, `/player`, `/settings`, `/import`; body background `rgb(11,13,16)` on all; no console errors on any route.
- Board: hold key height **49px** vs passage cell height **68px**; hold key bottom 776 vs bottom-nav top 785 → **9px gap**; last cell bottom 423.
- Reciting: four rating keypads **66px** tall each, fully inside the viewport (rows 514–579 / 587–653); pinned grid bottom row bottom 776 vs nav top 785 → 9px gap.
- Long text: page scrollHeight 878 vs viewport 844; **single scroll container** (revealed text panel clientHeight 258 = scrollHeight 258); after scrolling to the end the text bottom is 521 while the pinned keys start at 637 → the last line always clears the keys.
- PNG decode audit with an independent decoder (unfiltering implemented): every capture is non-blank and dominated by `11,13,16`; distinct sampled colours 376–1346.
- `impeccable detect --json src` → `[]` (no findings). No hook findings available.
- `tsc -b` clean; **62 vitest tests pass**; production build succeeds.

## Provenance hazard you must weigh

Parts of this workspace were changed by a *different* agent that was asked to review but instead implemented, then went beyond the request (it re-added six previously discarded visual worlds as selectable skins; it also claims an `.ics` rollover fix, focus/Escape handling, route-level code splitting, and editable work metadata). The builder has since reverted the six-skin world system to a single world (`src\theme\themes.ts` ships one world; `/design` is a read-only record page; `DESIGN.md` updated to match) and re-verified the four acceptance criteria above. Treat every unverified claim in the codebase with suspicion: check it rather than trusting this paragraph.

## Known limitations (do not accept the builder's framing without checking)

1. The builder model has no image input, so **no human-style visual read of the screenshots happened**. If you also cannot view images, say so explicitly and treat it as a named evidence gap, judging from code plus the measurements above.
2. Only 今日复习 received the full committed treatment; 篇目 / 播放 / 设置 / 导入 inherit the world's tokens and primitives but were not re-composed. Judge whether that is an acceptable round or a material gap.
3. The estimate constants (×1.15 over audio length, default 150 字/分钟, +8s per passage) are product decisions recorded in the brief, not measurements.
