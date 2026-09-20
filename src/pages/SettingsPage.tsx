import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Dialog from '../components/Dialog'
import Band from '../components/Band'
import { IconDownload, IconUpload } from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { buildDailyReminderIcs } from '../lib/ics'
import { downloadBlob } from '../lib/backup'
import { todayKey } from '../lib/date'
import { findTheme } from '../theme/themes'
import { MAX_RECITE_PACE, MIN_RECITE_PACE } from '../lib/estimate'
import {
  DEFAULT_SYNC_ENDPOINT,
  formatSyncCode,
  generateSyncCode,
  isValidSyncCode,
  DEFAULT_GITHUB_API,
} from '../lib/syncConfig'
import { formatRelativeTime } from '../lib/selectors'
import { formatBytes } from '../lib/format'
import { GIST_CONTENT_LIMIT_BYTES } from '../lib/syncMerge'

const APP_VERSION = '0.1.0'

/** 状态灯键：开＝段点亮成绿，关＝熄灭 */
function LampKey({
  name,
  on,
  onLabel,
  offLabel,
  onPress,
}: {
  /** 无障碍名：状态灯的读法应该是「篇目页显示拼音，已开启」 */
  name: string
  on: boolean
  onLabel: string
  offLabel: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={on}
      onClick={onPress}
      className={`flex items-center gap-2 border px-2.5 py-1.5 ${
        on ? 'border-done/55' : 'border-hairline'
      }`}
      style={{ borderRadius: 'var(--c-radius-sm)' }}
    >
      <span className="segbar w-3">
        <i className={`seg ${on ? 'seg-done' : ''}`} />
        <i className={`seg ${on ? 'seg-done' : ''}`} />
      </span>
      <span className={`readout text-[11px] ${on ? 'text-done' : 'text-dim'}`}>
        {on ? onLabel : offLabel}
      </span>
    </button>
  )
}

/** 动作键 */
function ProviderKey({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={`border px-2.5 py-1.5 text-[13px] ${
        active ? 'border-lit/60 text-fg' : 'border-hairline text-dim hover:bg-well'
      }`}
      style={{ borderRadius: 'var(--c-radius-sm)' }}
    >
      {label}
    </button>
  )
}

function ActKey({
  label,
  onPress,
  tone = 'default',
}: {
  label: string
  onPress: () => void
  tone?: 'default' | 'alert'
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`border px-3 py-1.5 text-[13px] ${
        tone === 'alert'
          ? 'border-alert/50 text-alert hover:bg-alert/5'
          : 'border-hairline text-fg-soft hover:bg-well'
      }`}
      style={{ borderRadius: 'var(--c-radius-sm)' }}
    >
      {label}
    </button>
  )
}

function GroupLabel({ children }: { children: string }) {
  return <p className="readout px-1 pt-2 text-[10px] tracking-[0.24em] text-dim">{children}</p>
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const exportJson = useAppStore((s) => s.exportJson)
  const importJson = useAppStore((s) => s.importJson)
  const exportAudio = useAppStore((s) => s.exportAudio)
  const importAudio = useAppStore((s) => s.importAudio)
  const clearAll = useAppStore((s) => s.clearAll)
  const resetReviewRecords = useAppStore((s) => s.resetReviewRecords)
  const syncNow = useAppStore((s) => s.syncNow)
  const updateSync = useAppStore((s) => s.updateSync)
  const notify = useAppStore((s) => s.notify)
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const audios = useAppStore((s) => s.audios)

  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(
    null,
  )
  const [openBand, setOpenBand] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmResetReview, setConfirmResetReview] = useState(false)
  const [clearWord, setClearWord] = useState('')
  const [pendingImport, setPendingImport] = useState<File | null>(null)

  const jsonInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const estimate = await navigator.storage?.estimate?.()
        const persisted = (await navigator.storage?.persisted?.()) ?? false
        if (!cancelled) {
          setStorage({
            usage: estimate?.usage ?? 0,
            quota: estimate?.quota ?? 0,
            persisted,
          })
        }
      } catch {
        // 忽略
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [audios.length])

  const requestPersist = async () => {
    try {
      const granted = (await navigator.storage?.persist?.()) ?? false
      notify(granted ? '已获得持久化存储权限' : '浏览器未授予持久化权限', granted ? 'success' : 'error')
      const estimate = await navigator.storage?.estimate?.()
      setStorage({
        usage: estimate?.usage ?? 0,
        quota: estimate?.quota ?? 0,
        persisted: granted,
      })
    } catch {
      notify('当前浏览器不支持该设置', 'error')
    }
  }

  const downloadIcs = () => {
    const ics = buildDailyReminderIcs({
      time: settings.reminderTime,
      startDate: todayKey(),
      title: '今日背书',
      description: '打开「国学背诵」，完成今日到期的复习卡片。',
    })
    downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), '国学背诵-每日提醒.ics')
    notify('日历文件已下载，导入「日历」App 即可每日提醒', 'success')
  }

  const toggleBand = (id: string) => setOpenBand((prev) => (prev === id ? null : id))
  const usingGist = settings.sync.provider === 'gist'
  // Gist 单个文件：1 MB 以内直接返回全文，超过就只给前 1 MB（App 改读 raw_url，可用到 10 MB）
  const overGistTruncation = (settings.sync.lastSizeBytes ?? 0) > GIST_CONTENT_LIMIT_BYTES
  const nearGistCeiling = (settings.sync.lastSizeBytes ?? 0) > 8 * GIST_CONTENT_LIMIT_BYTES
  const syncReady = usingGist
    ? settings.sync.token.trim().length > 0
    : isValidSyncCode(settings.sync.code)
  const syncBlockedLabel = usingGist ? '请先粘贴令牌' : '先设同步码'
  const syncBlockedHint = usingGist
    ? '请先粘贴 GitHub 令牌（只勾 gists 权限）'
    : '请先设置同步码（至少 8 位，或点「生成随机码」）'
  const sliderClass = 'w-full accent-[#FF2E1F]'

  return (
    <>
      <PageHeader title="设置" subtitle={`国学背诵 v${APP_VERSION} · 所有数据只在本机`} />

      <div className="mx-auto max-w-2xl space-y-2 px-4 py-4">
        <GroupLabel>显示 DISPLAY</GroupLabel>
        <Band
          label="视觉世界"
          value={findTheme(settings.theme).name}
          tone="dim"
          action={<ActKey label="查看" onPress={() => navigate('/design')} />}
        />
        <Band
          label="正文字号"
          value={`${settings.fontScale.toFixed(2)}×`}
          open={openBand === 'font'}
          onToggle={() => toggleBand('font')}
        >
          <input
            type="range"
            min={0.85}
            max={1.5}
            step={0.05}
            value={settings.fontScale}
            className={sliderClass}
            onChange={(e) => void updateSettings({ fontScale: Number.parseFloat(e.target.value) })}
          />
        </Band>
        <Band
          label="正文行高"
          value={settings.lineHeight.toFixed(2)}
          open={openBand === 'line'}
          onToggle={() => toggleBand('line')}
        >
          <input
            type="range"
            min={1.5}
            max={2.6}
            step={0.05}
            value={settings.lineHeight}
            className={sliderClass}
            onChange={(e) => void updateSettings({ lineHeight: Number.parseFloat(e.target.value) })}
          />
        </Band>
        <Band
          label="篇目页显示拼音"
          control={
            <LampKey
              name="篇目页显示拼音"
              on={settings.pinyinVisible}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ pinyinVisible: !settings.pinyinVisible })}
            />
          }
        />
        <Band
          label="复习时带拼音"
          control={
            <LampKey
              name="复习时带拼音"
              on={settings.pinyinInReview}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ pinyinInReview: !settings.pinyinInReview })}
            />
          }
        />
        <Band
          label="竖排显示正文"
          control={
            <LampKey
              name="竖排显示正文"
              on={settings.vertical}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ vertical: !settings.vertical })}
            />
          }
        />
        <Band
          label="背诵速度"
          kicker="字 / 分钟"
          value={String(settings.recitePace)}
          hint="决定首页「预计用时」读数"
          open={openBand === 'pace'}
          onToggle={() => toggleBand('pace')}
        >
          <input
            type="range"
            min={MIN_RECITE_PACE}
            max={MAX_RECITE_PACE}
            step={10}
            value={settings.recitePace}
            className={sliderClass}
            onChange={(e) => void updateSettings({ recitePace: Number.parseInt(e.target.value, 10) })}
          />
        </Band>

        <GroupLabel>提醒 REMINDER</GroupLabel>
        <Band
          label="每日提醒时间"
          value={settings.reminderTime}
          open={openBand === 'reminder'}
          onToggle={() => toggleBand('reminder')}
        >
          <input
            type="time"
            className="field"
            value={settings.reminderTime}
            onChange={(e) => void updateSettings({ reminderTime: e.target.value })}
          />
        </Band>
        <Band
          label="导出日历提醒"
          kicker="ICS · 一次导入长期有效"
          action={<ActKey label="导出" onPress={downloadIcs} />}
        />

        <GroupLabel>云同步 SYNC</GroupLabel>
        <Band
          label="云端存哪"
          kicker="两种都行 · 数据先写本机，同步是后台动作"
          control={
            <span className="flex gap-1.5">
              <ProviderKey
                active={settings.sync.provider === 'gist'}
                label="GitHub"
                onPress={() => void updateSync({ provider: 'gist' })}
              />
              <ProviderKey
                active={settings.sync.provider === 'cloudflare'}
                label="Cloudflare"
                onPress={() => void updateSync({ provider: 'cloudflare' })}
              />
            </span>
          }
        />

        {settings.sync.provider === 'gist' ? (
          <>
            <Band
              label="GitHub 令牌"
              kicker="只勾 gists 权限即可"
              value={settings.sync.token ? '已设置' : '未设置'}
              tone={settings.sync.token ? 'done' : 'dim'}
              open={openBand === 'token'}
              onToggle={() => toggleBand('token')}
            >
              <div className="space-y-3">
                <input
                  type="password"
                  aria-label="GitHub 令牌"
                  className="field readout text-[13px]"
                  placeholder="ghp_… 或 github_pat_…"
                  value={settings.sync.token}
                  onChange={(e) => void updateSync({ token: e.target.value.trim() })}
                />
                <input
                  aria-label="GitHub API 地址"
                  className="field readout text-[13px]"
                  placeholder={DEFAULT_GITHUB_API}
                  value={settings.sync.api}
                  onChange={(e) => void updateSync({ api: e.target.value.trim() })}
                />
                <p className="text-[13px] leading-relaxed text-dim">
                  令牌只存在这台设备上，不参与同步。到
                  github.com/settings/tokens 建一个 classic token，权限只勾 <b>gists</b>；
                  有效期选「No expiration」最省心，否则到期后在这里粘贴新的就行——云端那份数据不受影响。
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActKey
                    label="清除令牌"
                    onPress={() => void updateSync({ token: '', gistId: '' })}
                  />
                </div>
              </div>
            </Band>
            <Band
              label="云端 Gist"
              kicker="首次同步时自动建立，描述为 guoxue-recitation-sync"
              value={settings.sync.gistId ? `${settings.sync.gistId.slice(0, 8)}…` : '未建立'}
              tone="dim"
            />
          </>
        ) : (
          <Band
            label="同步码"
            kicker="两端填同一个码即同一份数据"
            value={settings.sync.code ? formatSyncCode(settings.sync.code) : '未设置'}
            tone={settings.sync.code ? 'default' : 'dim'}
            open={openBand === 'synccode'}
            onToggle={() => toggleBand('synccode')}
          >
            <div className="space-y-3">
              <input
                aria-label="同步码"
                className="field readout tracking-[0.2em]"
                placeholder="输入另一端显示的同步码"
                value={formatSyncCode(settings.sync.code)}
                onChange={(e) => void updateSync({ code: e.target.value })}
              />
              <input
                aria-label="同步服务地址"
                className="field readout text-[13px]"
                placeholder={DEFAULT_SYNC_ENDPOINT}
                value={settings.sync.endpoint}
                onChange={(e) => void updateSync({ endpoint: e.target.value.trim() })}
              />
              <div className="flex flex-wrap gap-2">
                <ActKey
                  label="生成随机码"
                  onPress={() => void updateSync({ code: generateSyncCode() })}
                />
                {settings.sync.code ? (
                  <ActKey label="清空" onPress={() => void updateSync({ code: '' })} />
                ) : null}
              </div>
              <p className="text-[13px] leading-relaxed text-dim">
                同步码就是钥匙——电脑上生成一个，手机上输入同一个，两边的篇目、拼音、注释与复习进度就会合并到一起。
                没有账号、没有密码，所以码要自己收好：知道这个码的人就能读写你的数据。
              </p>
              <p className="readout text-[10px] tracking-[0.14em] text-dim">
                ENDPOINT {settings.sync.endpoint || DEFAULT_SYNC_ENDPOINT}
              </p>
            </div>
          </Band>
        )}

        <Band
          label="立即同步"
          kicker="双向合并 · 云端与本地取较新"
          hint={
            settings.sync.lastSyncedAt
              ? `上次同步 ${formatRelativeTime(settings.sync.lastSyncedAt)}`
              : '还没有同步过'
          }
          action={
            <ActKey
              label={syncReady ? '同步' : syncBlockedLabel}
              onPress={() => {
                if (!syncReady) {
                  setOpenBand(settings.sync.provider === 'gist' ? 'token' : 'synccode')
                  notify(syncBlockedHint, 'error')
                  return
                }
                void syncNow()
              }}
            />
          }
        />
        <Band
          label="自动同步"
          kicker="每次打开与改动后"
          control={
            <LampKey
              name="自动同步"
              on={settings.sync.auto}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSync({ auto: !settings.sync.auto })}
            />
          }
        />
        <Band
          label="上次同步"
          kicker="LOCAL → CLOUD"
          value={settings.sync.lastSyncedAt ? formatRelativeTime(settings.sync.lastSyncedAt) : '—'}
          tone={settings.sync.lastSyncedAt ? 'done' : 'dim'}
        />
        {usingGist ? (
          <Band
            label="云端文件体积"
            kicker="超过 1 MB 走全文读取 · 10 MB 是硬上限"
            value={settings.sync.lastSizeBytes ? formatBytes(settings.sync.lastSizeBytes) : '—'}
            tone={nearGistCeiling ? 'alert' : 'dim'}
            hint={
              nearGistCeiling
                ? '快碰到 GitHub 的 10 MB 硬上限了，先导出一份备份'
                : overGistTruncation
                  ? 'GitHub 只返回前 1 MB，App 会自动改读全文（稍慢，但内容完整）'
                  : '1 MB 以内 GitHub 直接返回全文'
            }
          />
        ) : null}

        <GroupLabel>数据 DATA</GroupLabel>
        <Band
          label="篇目与段落"
          kicker="篇 / 段 / 录音"
          value={`${works.length} / ${passages.length} / ${audios.length}`}
          hint={storage ? `已占用 ${formatBytes(storage.usage)}` : undefined}
        />
        <Band
          label="导出数据"
          kicker="JSON"
          action={
            <button
              type="button"
              className="flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[13px] text-fg-soft hover:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={() => void exportJson()}
            >
              <IconDownload className="h-3.5 w-3.5" />
              导出
            </button>
          }
        />
        <Band
          label="导入数据"
          kicker="JSON · 覆盖当前"
          action={
            <button
              type="button"
              className="flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[13px] text-fg-soft hover:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={() => jsonInputRef.current?.click()}
            >
              <IconUpload className="h-3.5 w-3.5" />
              导入
            </button>
          }
        />
        <Band
          label="导出录音"
          kicker="ZIP · 按篇目打包"
          action={<ActKey label="导出" onPress={() => void exportAudio()} />}
        />
        <Band
          label="导入录音"
          kicker="ZIP · 先导数据"
          action={<ActKey label="导入" onPress={() => zipInputRef.current?.click()} />}
        />
        <Band
          label="持久化存储"
          hint={storage?.persisted ? '浏览器不会自动清理' : '建议开启，避免数据被清理'}
          control={
            <LampKey
              name="持久化存储"
              on={!!storage?.persisted}
              onLabel="ON"
              offLabel="申请"
              onPress={() => void requestPersist()}
            />
          }
        />

        <GroupLabel>装到手机上 INSTALL</GroupLabel>
        <Band
          label="添加到主屏幕"
          kicker="SAFARI → 分享 → 添加到主屏幕"
          value="3 步"
          tone="dim"
          open={openBand === 'install'}
          onToggle={() => toggleBand('install')}
        >
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-fg-soft">
            <li>用 iPhone 的 Safari 打开本站地址</li>
            <li>点底部的「分享」按钮</li>
            <li>选择「添加到主屏幕」，之后就像 App 一样全屏打开</li>
          </ol>
          <p className="mt-2 text-[13px] leading-relaxed text-dim">
            未添加到主屏时，iOS 可能在长期不用后清理本地数据。请务必添加到主屏，并定期导出备份。
          </p>
        </Band>

        <GroupLabel>危险 IRREVERSIBLE</GroupLabel>
        <Band
          label="清空全部数据"
          kicker="不可恢复"
          hint="删除所有篇目、录音与复习记录"
          danger
          action={
            <ActKey
              label="清空"
              tone="alert"
              onPress={() => {
                setClearWord('')
                setConfirmClear(true)
              }}
            />
          }
        />

        <Band
          label="清空全部复习记录"
          kicker="原文、拼音、注释、录音都保留"
          hint="每篇按新卡重新开始；热力图与打卡归零"
          action={<ActKey label="清空记录" onPress={() => setConfirmResetReview(true)} />}
        />

        <p className="pb-2 pt-3 text-center text-[13px] leading-relaxed text-dim">
          数据只存在这台设备的浏览器里，不上传服务器。
          <br />
          换手机时先导出数据与录音，再在新设备导入。
        </p>
      </div>

      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPendingImport(file)
          e.target.value = ''
        }}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept="application/zip,.zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importAudio(file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={!!pendingImport}
        title="导入数据会覆盖当前内容"
        description={`文件：${pendingImport?.name ?? ''}。当前的篇目、段落与复习进度会被替换，录音文件不受影响。`}
        confirmText="覆盖导入"
        danger
        onConfirm={() => {
          const file = pendingImport
          setPendingImport(null)
          if (file) void importJson(file)
        }}
        onCancel={() => setPendingImport(null)}
      />

      <Dialog
        open={confirmResetReview}
        title="清空全部复习记录？"
        description="所有篇目的排期与历史会复位成新卡，热力图与打卡记录清空。原文、拼音、注释、要背标记与录音都保留。"
        confirmText="清空记录"
        danger
        onConfirm={() => {
          setConfirmResetReview(false)
          void resetReviewRecords()
        }}
        onCancel={() => setConfirmResetReview(false)}
      />

      <Dialog
        open={confirmClear}
        title="清空全部数据？"
        description="所有篇目、原文、拼音、注释、录音与复习记录都会永久删除，无法恢复。"
        confirmText="永久清空"
        confirmDisabled={clearWord !== '清空'}
        danger
        onConfirm={() => {
          setConfirmClear(false)
          void clearAll()
        }}
        onCancel={() => setConfirmClear(false)}
      >
        <input
          className="field"
          placeholder="输入「清空」以确认"
          value={clearWord}
          onChange={(e) => setClearWord(e.target.value)}
        />
      </Dialog>
    </>
  )
}
