import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import Dialog from '../components/Dialog'
import RubyText from '../components/RubyText'
import MasteryBar from '../components/MasteryBar'
import {
  IconChevron,
  IconMic,
  IconPlay,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { usePlayerStore } from '../store/player'
import { useToday } from '../hooks/useToday'
import { audioByPassageId, passagesOfWork, workProgress } from '../lib/selectors'
import { isDue, isMastered, masteryBand, masteryScore } from '../lib/srs'
import { resolveTokens } from '../lib/pinyin'
import { describePlan, planMatch, type MatchPlan } from '../lib/match'
import { relativeDay } from '../lib/date'
import type { AudioAsset, Passage, Settings, Work } from '../types'

type FilterKey = 'all' | 'due' | 'mastered' | 'audio'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'due', label: '待复习' },
  { key: 'mastered', label: '已掌握' },
  { key: 'audio', label: '有录音' },
]

export default function LibraryPage() {
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const audios = useAppStore((s) => s.audios)
  const settings = useAppStore((s) => s.settings)
  const today = useToday()
  const [searchParams, setSearchParams] = useSearchParams()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const grouped = useMemo(
    () => works.map((work) => ({ work, items: passagesOfWork(passages, work.id) })),
    [works, passages],
  )

  // 一次只摊开一篇：当前篇目由地址里的 ?work 决定，所以每篇都可深链
  const requestedId = searchParams.get('work')
  const active = useMemo(() => {
    if (!grouped.length) return null
    return grouped.find((entry) => entry.work.id === requestedId) ?? grouped[0]
  }, [grouped, requestedId])
  const activeIndex = active ? grouped.findIndex((entry) => entry.work.id === active.work.id) : -1

  const goTo = useCallback(
    (workId: string) => {
      const next = new URLSearchParams(searchParams)
      next.set('work', workId)
      setSearchParams(next, { replace: true })
      setPickerOpen(false)
    },
    [searchParams, setSearchParams],
  )

  const step = useCallback(
    (delta: number) => {
      if (!grouped.length) return
      const next = (activeIndex + delta + grouped.length) % grouped.length
      goTo(grouped[next].work.id)
    },
    [activeIndex, grouped, goTo],
  )

  const visible = useMemo(() => {
    const q = query.trim()
    return grouped.filter(({ work, items }) => {
      if (
        q &&
        !work.title.includes(q) &&
        !(work.author ?? '').includes(q) &&
        !(work.dynasty ?? '').includes(q) &&
        !items.some((p) => p.text.includes(q))
      ) {
        return false
      }
      if (filter === 'due') return items.some((p) => p.isRecite && isDue(p.srs, today))
      if (filter === 'mastered') {
        const recite = items.filter((p) => p.isRecite)
        return recite.length > 0 && recite.every((p) => isMastered(p.srs))
      }
      if (filter === 'audio') return items.some((p) => p.audioId)
      return true
    })
  }, [grouped, query, filter, today])

  return (
    <>
      <PageHeader
        title="篇目"
        subtitle={
          active
            ? `第 ${String(activeIndex + 1).padStart(2, '0')} / 共 ${String(grouped.length).padStart(2, '0')} 篇　${passages.length} 段`
            : `${works.length} 篇`
        }
        actions={
          <>
            <button
              type="button"
              aria-label="篇目一览"
              className="flex h-9 items-center gap-1 border border-hairline px-3 text-sm text-fg-soft active:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={() => setPickerOpen(true)}
            >
              <IconSearch className="h-4 w-4" />
              篇目
            </button>
            <Link
              to="/import"
              className="flex h-9 items-center gap-1 border border-hairline px-3 text-sm text-fg-soft active:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
            >
              <IconPlus className="h-4 w-4" />
              导入
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-2xl px-4 py-4">
        {works.length === 0 ? (
          <div className="panel px-5 py-10 text-center">
            <p className="text-[20px] text-fg">书箱还是空的</p>
            <p className="mt-2 text-[13px] leading-relaxed text-dim">
              把要背的文本粘进来，一行就是一段。
            </p>
            <Link to="/import" className="btn btn-primary mt-4">
              导入第一篇
            </Link>
          </div>
        ) : active ? (
          <WorkCard
            key={active.work.id}
            work={active.work}
            items={active.items}
            audioMap={audioByPassageId(audios)}
            settings={settings}
            today={today}
            index={activeIndex}
            total={grouped.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
        ) : null}
      </div>

      <Sheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="篇目一览"
        subtitle={`${works.length} 篇　${passages.length} 段`}
      >
        <div className="relative mb-3">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ghost" />
          <input
            className="field pl-9"
            placeholder="搜索篇名、作者或原文"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip shrink-0 ${filter === item.key ? 'chip-active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="meta py-6 text-center">没有符合条件的内容。</p>
        ) : (
          <ul className="space-y-2">
            {visible.map(({ work, items }) => {
              const recite = items.filter((p) => p.isRecite)
              const done = recite.filter((p) => p.srs.history.length > 0).length
              const isActive = work.id === active?.work.id
              return (
                <li key={work.id}>
                  <button
                    type="button"
                    className={`cellrow w-full text-left ${isActive ? 'cellrow-current' : ''}`}
                    onClick={() => goTo(work.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] leading-tight text-fg">
                        {work.title}
                      </span>
                      <span className="mt-1 block text-[13px] text-dim">
                        {[work.dynasty, work.author].filter(Boolean).join('・') || '未填朝代作者'}
                        　{done}/{recite.length} 段已背
                      </span>
                    </span>
                    <span className="segbar shrink-0">
                      {recite.slice(0, 5).map((p) => (
                        <i
                          key={p.id}
                          className={`seg ${p.srs.history.length ? 'seg-done' : ''}`}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </>
  )
}

interface WorkCardProps {
  work: Work
  items: Passage[]
  audioMap: Map<string, AudioAsset>
  settings: Settings
  today: string
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
}

function WorkCard({
  work,
  items,
  audioMap,
  settings,
  today,
  index,
  total,
  onPrev,
  onNext,
}: WorkCardProps) {
  const passages = useAppStore((s) => s.passages)
  const rewriteWorkText = useAppStore((s) => s.rewriteWorkText)
  const uploadAudioBatch = useAppStore((s) => s.uploadAudioBatch)
  const removeWork = useAppStore((s) => s.removeWork)
  const resetWork = useAppStore((s) => s.resetWork)
  const notify = useAppStore((s) => s.notify)

  const [editorOpen, setEditorOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const batchInputRef = useRef<HTMLInputElement>(null)

  const progress = workProgress(work, passages, today)

  const handleBatch = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const targets = items.slice(0, files.length)
    await uploadAudioBatch(
      Array.from(files).map((file, index) => ({ passageId: targets[index].id, file })),
    )
  }

  return (
    <article className="panel overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[20px] leading-tight text-fg">{work.title}</h2>
            {progress.dueCount ? (
              <span
                className="shrink-0 border border-lit/45 px-2 py-0.5 text-[10px] text-lit"
                style={{ borderRadius: 'var(--c-radius-sm)' }}
              >
                待复习 {progress.dueCount}
              </span>
            ) : null}
          </div>
          <p className="meta mt-0.5">
            {[
              work.dynasty,
              work.author,
              `${progress.total} 段`,
              `要背 ${progress.reciteCount}`,
              progress.audioCount ? `录音 ${progress.audioCount}` : null,
              work.tags.length ? work.tags.join('、') : null,
            ]
              .filter(Boolean)
              .join('・')}
          </p>
          {/* 一列段码：要背的每一段一根，已背的点亮成绿 */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex flex-1 flex-wrap gap-[3px]">
              {items
                .filter((p) => p.isRecite)
                .slice(0, 12)
                .map((p) => (
                  <i
                    key={p.id}
                    className={`h-1.5 flex-1 ${p.srs.history.length ? 'bg-done' : 'bg-lit/25'}`}
                    style={{ borderRadius: 1 }}
                  />
                ))}
            </span>
            <span className="readout shrink-0 text-[10px] text-dim">
              {progress.reviewedCount}/{progress.reciteCount} · {progress.mastery}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="readout block text-[13px] text-dim">
            第 {String(index + 1).padStart(2, '0')} / 共 {String(total).padStart(2, '0')} 篇
          </span>
          <span className="mt-1.5 flex justify-end gap-1">
            <button
              type="button"
              aria-label="上一篇"
              className="flex h-8 w-8 items-center justify-center border border-hairline text-fg-soft active:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={onPrev}
            >
              <IconChevron className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="下一篇"
              className="flex h-8 w-8 items-center justify-center border border-hairline text-fg-soft active:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={onNext}
            >
              <IconChevron className="h-4 w-4" />
            </button>
          </span>
        </div>
      </div>

      <div className="border-t border-paper-line px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className="chip" onClick={() => setMetaOpen(true)}>
              编辑篇目信息
            </button>
            <button type="button" className="chip" onClick={() => setEditorOpen(true)}>
              编辑全篇原文
            </button>
            <button type="button" className="chip" onClick={() => batchInputRef.current?.click()}>
              <IconMic className="h-3.5 w-3.5" />
              批量上传录音
            </button>
            <button type="button" className="chip" onClick={() => setConfirmReset(true)}>
              重置进度
            </button>
            <button
              type="button"
              className="chip border-cinnabar/30 text-cinnabar"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash className="h-3.5 w-3.5" />
              删除篇目
            </button>
          </div>
          <input
            ref={batchInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleBatch(e.target.files)
              e.target.value = ''
            }}
          />

          <ul className="space-y-2">
            {items.map((passage, index) => (
              <PassageRow
                key={passage.id}
                passage={passage}
                index={index}
                work={work}
                siblings={items}
                settings={settings}
                today={today}
                hasAudio={!!passage.audioId}
                durationMs={passage.audioId ? audioMap.get(passage.id)?.durationMs ?? null : null}
              />
            ))}
          </ul>
      </div>

      <WorkTextEditor
        open={editorOpen}
        work={work}
        items={items}
        onClose={() => setEditorOpen(false)}
        onSave={async (lines) => {
          const plan = await rewriteWorkText(work.id, lines)
          notify(plan.changed ? `原文已更新：${describePlan(plan)}` : '原文没有变化', 'success')
          setEditorOpen(false)
        }}
      />

      <WorkMetaEditor
        open={metaOpen}
        work={work}
        onClose={() => setMetaOpen(false)}
      />

      <Dialog
        open={confirmDelete}
        title={`删除《${work.title}》？`}
        description={`将同时删除 ${items.length} 段原文、录音与复习记录，无法撤销。`}
        confirmText="删除"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          void removeWork(work.id)
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <Dialog
        open={confirmReset}
        title={`重置《${work.title}》的复习进度？`}
        description="原文、拼音、注释与录音都会保留，只把排期清空、重新开始。"
        confirmText="重置"
        danger
        onConfirm={() => {
          setConfirmReset(false)
          void resetWork(work.id)
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </article>
  )
}

function WorkMetaEditor({
  open,
  work,
  onClose,
}: {
  open: boolean
  work: Work
  onClose: () => void
}) {
  const updateWorkMeta = useAppStore((s) => s.updateWorkMeta)
  const notify = useAppStore((s) => s.notify)
  const [title, setTitle] = useState(work.title)
  const [author, setAuthor] = useState(work.author ?? '')
  const [dynasty, setDynasty] = useState(work.dynasty ?? '')
  const [tags, setTags] = useState(work.tags.join('、'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(work.title)
    setAuthor(work.author ?? '')
    setDynasty(work.dynasty ?? '')
    setTags(work.tags.join('、'))
  }, [open, work])

  const save = async () => {
    if (!title.trim()) {
      notify('篇名不能为空', 'error')
      return
    }
    setSaving(true)
    try {
      await updateWorkMeta(work.id, {
        title: title.trim(),
        author: author.trim(),
        dynasty: dynasty.trim(),
        tags: tags
          .split(/[,，、\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      notify('篇目信息已更新', 'success')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="编辑篇目信息"
      subtitle="只改篇名、朝代、作者与标签"
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="meta-title">
            篇名
          </label>
          <input
            id="meta-title"
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="meta-dynasty">
              朝代
            </label>
            <input
              id="meta-dynasty"
              className="field"
              value={dynasty}
              onChange={(event) => setDynasty(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="meta-author">
              作者
            </label>
            <input
              id="meta-author"
              className="field"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="meta-tags">
            标签
          </label>
          <input
            id="meta-tags"
            className="field"
            placeholder="用逗号、顿号或空格分隔"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>
      </div>
    </Sheet>
  )
}

interface PassageRowProps {
  passage: Passage
  index: number
  work: Work
  siblings: Passage[]
  settings: Settings
  today: string
  hasAudio: boolean
  durationMs: number | null
}

function PassageRow({
  passage,
  index,
  work,
  siblings,
  settings,
  today,
  hasAudio,
  durationMs,
}: PassageRowProps) {
  const patchPassage = useAppStore((s) => s.patchPassage)
  const savePassageEdit = useAppStore((s) => s.savePassageEdit)
  const removePassage = useAppStore((s) => s.removePassage)
  const resetPassage = useAppStore((s) => s.resetPassage)
  const uploadAudio = useAppStore((s) => s.uploadAudio)
  const deleteAudio = useAppStore((s) => s.deleteAudio)
  const notify = useAppStore((s) => s.notify)
  const loadWork = usePlayerStore((s) => s.loadWork)
  const playPassage = usePlayerStore((s) => s.playPassage)

  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(passage.text)
  const [draftNote, setDraftNote] = useState(passage.note)
  const [overrides, setOverrides] = useState<Record<string, string>>(passage.pinyinOverrides)
  const [showPinyinEditor, setShowPinyinEditor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) return
    setDraftText(passage.text)
    setDraftNote(passage.note)
    setOverrides(passage.pinyinOverrides)
  }, [passage, editing])

  const tokens = useMemo(
    () => resolveTokens(passage.text, passage.pinyinCache, passage.pinyinOverrides),
    [passage],
  )
  const draftTokens = useMemo(() => resolveTokens(draftText, null, overrides), [draftText, overrides])
  const due = isDue(passage.srs, today)
  const band = masteryBand(masteryScore(passage.srs))

  const handlePlay = () => {
    const audioIds = siblings.filter((p) => p.audioId).map((p) => p.id)
    loadWork(work.id, audioIds, passage.id)
    void playPassage(passage.id)
  }

  const handleSave = async () => {
    if (!draftText.trim()) {
      notify('原文不能为空', 'error')
      return
    }
    await savePassageEdit(passage.id, { text: draftText, note: draftNote, overrides })
    setEditing(false)
  }

  return (
    <li className="border border-hairline bg-well px-3 py-3" style={{ borderRadius: 'var(--c-radius)' }}>
      <div className="flex items-start gap-2.5">
        <span
          className={`readout mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] ${
            passage.isRecite ? 'bg-ink/6 text-ink-soft' : 'bg-paper-deep text-ink-faint'
          }`}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              className="field min-h-[92px] font-song text-[17px] leading-7"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
          ) : (
            <div
              className={`text-body text-ink ${
                passage.isRecite ? '' : 'text-ink-faint'
              } ${
                settings.vertical
                  ? 'text-vertical max-h-[38vh] overflow-x-auto'
                  : ''
              }`}
            >
              <RubyText tokens={tokens} showPinyin={settings.pinyinVisible} />
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!passage.isRecite ? <span className="chip">不背</span> : null}
            {hasAudio ? <span className="chip">录音</span> : null}
            {passage.isRecite ? (
              <span className={`chip ${due ? 'border-cinnabar/30 text-cinnabar' : ''}`}>
                {due ? '待复习' : `下次 ${relativeDay(passage.srs.dueAt, today)}`}
              </span>
            ) : null}
            <span className="chip">{band.label}</span>
            {passage.srs.history.length ? (
              <span className="chip">已背 {passage.srs.history.length} 次</span>
            ) : null}
          </div>

          {!editing && passage.note ? (
            <p className="mt-2 bg-paper-deep/60 px-2.5 py-2 text-[13px] leading-relaxed text-ink-soft">
              {passage.note}
            </p>
          ) : null}

          {!editing ? (
            <MasteryBar srs={passage.srs} className="mt-2" />
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-paper-line pt-3">
          <div>
            <label className="label">注释</label>
            <textarea
              className="field min-h-[68px] text-[15px] leading-6"
              placeholder="写下字词解释、背景或自己的理解"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">拼音逐字修正</span>
              <button
                type="button"
                className="text-xs text-ink-faint underline-offset-2 hover:underline"
                onClick={() => setShowPinyinEditor((v) => !v)}
              >
                {showPinyinEditor ? '收起' : '展开'}
              </button>
            </div>
            {showPinyinEditor ? (
              <div className="max-h-56 overflow-y-auto border border-hairline bg-paper-soft p-2" style={{ borderRadius: 'var(--c-radius-sm)' }}>
                <div className="flex flex-wrap gap-1.5">
                  {draftTokens.map((token) => {
                    if (!token.pinyin) {
                      return (
                        <span
                          key={token.index}
                          className="flex h-14 w-11 items-center justify-center font-song text-lg text-ink-faint"
                        >
                          {token.char}
                        </span>
                      )
                    }
                    return (
                      <label key={token.index} className="w-11 shrink-0">
                        <input
                          className="readout h-6 w-full border border-transparent bg-transparent px-0.5 text-center text-[11px] text-ink-soft outline-none focus:border-paper-line focus:bg-paper"
                          value={overrides[String(token.index)] ?? token.pinyin}
                          onChange={(e) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [String(token.index)]: e.target.value,
                            }))
                          }
                        />
                        <span className="block text-center font-song text-lg leading-6 text-ink">
                          {token.char}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="meta">需要纠正多音字时展开，逐字填写拼音即可。</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>
              保存
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(false)
                setDraftText(passage.text)
                setDraftNote(passage.note)
                setOverrides(passage.pinyinOverrides)
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void patchPassage(passage.id, { isRecite: !passage.isRecite })}
            >
              {passage.isRecite ? '设为不用背' : '设为要背'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOverrides({})
                void patchPassage(passage.id, { pinyinOverrides: {} })
              }}
            >
              清除拼音修正
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-8">
          {hasAudio ? (
            <>
              <button type="button" className="chip" onClick={handlePlay}>
                <IconPlay className="h-3.5 w-3.5" />
                播放
              </button>
              <button
                type="button"
                className="chip text-ink-faint"
                onClick={() => void deleteAudio(passage.id)}
              >
                删除录音
              </button>
            </>
          ) : null}
          <button type="button" className="chip" onClick={() => fileRef.current?.click()}>
            <IconMic className="h-3.5 w-3.5" />
            {hasAudio ? '替换录音' : '上传录音'}
          </button>
          <button type="button" className="chip" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => void patchPassage(passage.id, { isRecite: !passage.isRecite })}
          >
            {passage.isRecite ? '不背' : '要背'}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => void resetPassage(passage.id)}
          >
            重置
          </button>
          <button
            type="button"
            className="chip border-cinnabar/30 text-cinnabar"
            onClick={() => setConfirmDelete(true)}
          >
            删除
          </button>
          {durationMs ? (
            <span className="meta ml-auto">
              {Math.round(durationMs / 1000)} 秒
            </span>
          ) : null}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadAudio(passage.id, file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={confirmDelete}
        title="删除这一段？"
        description={
          passage.srs.history.length || hasAudio
            ? '这一段有复习进度或录音，删除后无法恢复。'
            : '删除后无法恢复。'
        }
        confirmText="删除"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          void removePassage(passage.id)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  )
}

interface WorkTextEditorProps {
  open: boolean
  work: Work
  items: Passage[]
  onClose: () => void
  onSave: (lines: string[]) => Promise<void>
}

function WorkTextEditor({ open, work, items, onClose, onSave }: WorkTextEditorProps) {
  const [text, setText] = useState('')
  const [plan, setPlan] = useState<MatchPlan | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setText(items.map((p) => p.text).join('\n'))
      setPlan(null)
    }
  }, [open, items])

  const lines = useMemo(
    () =>
      text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [text],
  )

  const preview = () => setPlan(planMatch(items, lines))

  return (
    <>
      <Sheet
        open={open && !plan}
        onClose={onClose}
        title={`编辑《${work.title}》原文`}
        subtitle="一行一段；改完会按文本自动对应旧段落"
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={lines.length === 0}
              onClick={preview}
            >
              预览改动
            </button>
          </div>
        }
      >
        <textarea
          className="field min-h-[52vh] font-song text-[17px] leading-8"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Sheet>

      <Dialog
        open={open && !!plan}
        title="确认替换原文"
        description={
          plan ? (
            <div className="space-y-2">
              <p>{describePlan(plan) || '原文没有变化'}</p>
              <p className="text-xs text-ink-faint">
                文本相同的段落会保留原有录音与复习进度；新行按新卡处理。
              </p>
            </div>
          ) : null
        }
        confirmText={saving ? '保存中…' : '确认替换'}
        confirmDisabled={saving || !plan?.changed}
        danger={!!plan?.removedWithData.length}
        onConfirm={async () => {
          setSaving(true)
          try {
            await onSave(lines)
            setPlan(null)
          } finally {
            setSaving(false)
          }
        }}
        onCancel={() => setPlan(null)}
      />
    </>
  )
}
