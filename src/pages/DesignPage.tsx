import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useAppStore } from '../store/useAppStore'
import { findTheme } from '../theme/themes'

/** 这个世界替掉了什么、留下了哪几条纪律 */
const KEPT_DISCIPLINES = [
  { from: '手迹状态', line: '已背与生疏由点亮/熄灭的段承担，不出现对勾徽章。' },
  { from: '不缩版', line: '小屏宁可少放一格，也不把整块读数缩到看不清。' },
  { from: '纪念碑字重', line: '进度与分钟数用大号等宽读数承担重量，不做小徽章。' },
  { from: '一次拉动', line: '长按一次就从读数板转进背诵态，状态有名字。' },
]

export default function DesignPage() {
  const navigate = useNavigate()
  const themeId = useAppStore((s) => s.settings.theme)
  const world = findTheme(themeId)

  const swatches = [
    { label: '地面', value: world.vars['--c-ground'] },
    { label: '面板', value: world.vars['--c-panel'] },
    { label: '发光', value: world.vars['--c-lit'] },
    { label: '完成', value: world.vars['--c-done'] },
    { label: '逾期', value: world.vars['--c-alert'] },
    { label: '幽灵', value: world.vars['--c-lit-ghost'] },
  ]

  return (
    <>
      <PageHeader
        title="设计方向"
        subtitle="这个 App 的视觉世界"
        back
        onBack={() => navigate('/settings')}
      />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="panel px-4 py-4">
          <h2 className="text-[19px] text-fg">{world.name}</h2>
          <p className="mt-1 text-[13px] text-dim">{world.tagline}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-soft">{world.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {swatches.map((swatch) => (
              <span
                key={swatch.label}
                className="flex items-center gap-2 border border-hairline px-2 py-1 text-[11px] text-dim"
                style={{ borderRadius: 'var(--c-radius)' }}
              >
                <i
                  className="inline-block h-3 w-3"
                  style={{ background: `rgb(${swatch.value})` }}
                />
                {swatch.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel px-4 py-4">
          <h3 className="text-[15px] text-fg">为什么是它</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-soft">
            方向由骰子从一组候选里发出，然后由你点名选中：它原本是牌桌上的一张挑战牌，带来的纪律已经写进这个世界。
          </p>
          <ul className="mt-3 space-y-2">
            {KEPT_DISCIPLINES.map((item) => (
              <li key={item.from} className="flex gap-2 text-[12px] leading-relaxed text-dim">
                <span className="shrink-0 text-fg-soft">{item.from}</span>
                <span>{item.line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] tracking-[0.18em] text-dim">SEED cf51c6de · 2026-09-17</p>
        </section>

        <p className="pb-4 text-center text-[11px] leading-relaxed text-dim">
          这个世界约束所有页面：导航、篇目、播放、设置都在同一套令牌里。
        </p>
      </div>
    </>
  )
}
