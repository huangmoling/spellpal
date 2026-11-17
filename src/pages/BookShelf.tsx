import { useMemo } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Flame,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'
import type { Book } from '@/types'
import { useApp } from '@/store/useApp'
import { loadProgress, streakDays } from '@/utils/progress'
import { dueCards, cardCount } from '@/utils/srs'

export default function BookShelf({
  books,
  bookId,
  onPickBook,
}: {
  books: Book[]
  bookId: string
  onPickBook: (id: string) => void
}) {
  const book = books.find((b) => b.id === bookId) ?? books[0]
  const startUnit = useApp((s) => s.startUnit)
  const startReview = useApp((s) => s.startReview)

  /** 每单元的句子数，单元卡片和「继续练习」都用它 */
  const sentencesOf = (no: number) => (book.sentences ?? []).filter((s) => s.unit === no).length
  const sentenceCount = (book.sentences ?? []).length

  const lastUnit = Number(localStorage.getItem(`spellpal:last-unit:${book.id}`) || 1)
  const lastUnitData = book.units.find((u) => u.no === lastUnit) ?? book.units[0]

  const progress = useMemo(() => loadProgress(), [book.id])
  const unitProgress = (no: number) => progress[`${book.id}#${no}`]
  const finished = book.units.filter((u) => unitProgress(u.no)).length
  const accs = book.units
    .map((u) => unitProgress(u.no)?.acc)
    .filter((v): v is number => typeof v === 'number')
  const avgAcc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null
  const streak = streakDays()

  const due = useMemo(() => dueCards(book.id), [book.id])
  const cardsTotal = useMemo(() => cardCount(book.id), [book.id])

  const openUnit = (no: number) => {
    localStorage.setItem(`spellpal:last-unit:${book.id}`, String(no))
    startUnit(book, no)
  }

  const reviewNow = () => {
    const list = due.length ? due : dueCards(book.id, Date.now() + 365 * 86400000)
    startReview(
      book,
      list.map((c) => c.itemId),
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header
        className="flex h-16 shrink-0 items-center pl-8 pr-[132px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand shadow-[0_4px_16px_rgba(124,92,255,0.45)]">
            <span className="font-mono text-[15px] font-bold text-white">S</span>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide">小拼手</div>
            <div className="text-[10px] tracking-[0.18em] text-muted/60">SPELLPAL</div>
          </div>
        </div>
        <button
          className="no-drag ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-ink"
          title="设置"
        >
          <Settings size={17} strokeWidth={1.9} />
        </button>
      </header>

      {/* 内容区 */}
      <div className="mx-auto flex w-full max-w-[940px] flex-1 flex-col overflow-y-auto px-8 pb-4">
        {/* 教材切换：按学段分两行 */}
        {books.length > 1 && (
          <div className="flex shrink-0 flex-col gap-1.5">
            {[
              { key: 'starter', label: '启蒙', list: books.filter((b) => b.stage === 'starter') },
              { key: 'primary', label: '小学同步', list: books.filter((b) => b.stage !== 'starter') },
            ]
              .filter((g) => g.list.length > 0)
              .map((g) => (
                <div key={g.key} className="flex items-center gap-1.5">
                  <span className="w-[52px] shrink-0 text-[10.5px] tracking-wide text-muted/40">
                    {g.label}
                  </span>
                  {g.list.map((b) => {
                    const on = b.id === book.id
                    const done = b.units.filter((u) => progress[`${b.id}#${u.no}`]).length
                    return (
                      <button
                        key={b.id}
                        onClick={() => onPickBook(b.id)}
                        className={clsx(
                          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition',
                          on
                            ? 'bg-white/[0.08] text-ink ring-1 ring-white/10'
                            : 'text-muted/60 hover:bg-white/[0.04] hover:text-ink/85',
                        )}
                      >
                        {b.shortTitle}
                        <span
                          className={clsx('tabnum text-[10px]', on ? 'text-brand/80' : 'text-muted/35')}
                        >
                          {done}/{b.units.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
          </div>
        )}

        {/* 教材头部 */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted/65">
              <BookOpen size={13} strokeWidth={2} />
              <span>
                {book.publisher} · {book.series} · {book.edition}
              </span>
            </div>
            <h1 className="text-[28px] font-semibold leading-none tracking-wide">
              {book.shortTitle}
            </h1>
          </div>
          <div className="text-right leading-none">
            <div className="tabnum text-[30px] font-semibold leading-none text-brand">
              {book.wordCount}
            </div>
            <div className="mt-2 text-[11px] text-muted/55">
              个单词 · {book.units.length} 个单元 · {sentenceCount} 句
            </div>
          </div>
        </div>

        {/* 继续练习 */}
        <button
          onClick={() => openUnit(lastUnit)}
          className="group relative mt-5 w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2532] to-[#151b25] px-7 py-4 text-left ring-1 ring-white/[0.07] transition hover:ring-brand/45"
        >
          <div className="absolute -right-8 -top-20 h-52 w-52 rounded-full bg-brand/15 blur-2xl transition group-hover:bg-brand/25" />
          <div className="relative flex items-center gap-5">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-brand/90">
                <Sparkles size={12} strokeWidth={2.4} />
                {unitProgress(lastUnitData.no) ? '再练一次' : '继续练习'}
              </div>
              <div className="text-[22px] font-semibold leading-tight">
                Unit {lastUnitData.no}
              </div>
              <div className="mt-1.5 text-[12px] text-muted/70">
                {lastUnitData.theme} · {sentencesOf(lastUnitData.no)} 句 · 约 5 分钟
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted transition group-hover:text-ink">开始</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_24px_rgba(124,92,255,0.5)] transition group-hover:scale-105">
                <ArrowRight size={20} strokeWidth={2.4} />
              </span>
            </div>
          </div>
        </button>

        {/* 错题本 */}
        <button
          onClick={reviewNow}
          disabled={cardsTotal === 0}
          className={clsx(
            'group mt-4 flex shrink-0 items-center gap-4 rounded-xl px-5 py-3 text-left ring-1 transition',
            cardsTotal === 0
              ? 'cursor-default bg-card/40 ring-white/[0.05]'
              : 'bg-card/60 ring-white/[0.07] hover:bg-card hover:ring-brand/35',
          )}
        >
          <span
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              due.length > 0 ? 'bg-err/15 text-err/90' : 'bg-white/[0.05] text-muted/50',
            )}
          >
            <CalendarClock size={17} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-[13.5px] font-medium text-ink/90">错题本</span>
              <span className="tabnum text-[11px] text-muted/50">{cardsTotal} 句</span>
              {due.length > 0 && (
                <span className="rounded-md bg-err/15 px-1.5 py-[1px] text-[10.5px] text-err/90">
                  {due.length} 待复习
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-[11.5px] text-muted/55">
              {cardsTotal === 0
                ? '还没有错句，练完一个单元会自动收集'
                : due.length > 0
                  ? '按 1、3、7、16 天的节奏复习，打对的会自动移出'
                  : '今天没有要复习的句子，明天再来'}
            </span>
          </span>
          {cardsTotal > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-brand/80">
              {due.length > 0 ? '开始复习' : '全部复习'}
              <ArrowRight size={13} strokeWidth={2.4} />
            </span>
          )}
        </button>

        {/* 单元标题 */}
        <div className="mb-2.5 mt-4 flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium text-ink/80">全部单元</h2>
          <span className="text-[11px] text-muted/45">
            <Layers size={10} strokeWidth={2.4} className="mr-1 inline" />
            每单元约 {Math.max(1, Math.round(sentenceCount / Math.max(1, book.units.length)))} 句
          </span>
        </div>

        {/* 单元网格 */}
        <div className="grid grid-cols-3 gap-2.5">
          {book.units.map((u) => (
            <button
              key={u.no}
              onClick={() => openUnit(u.no)}
              className="group flex min-h-[104px] shrink-0 flex-col rounded-xl bg-card/60 p-3.5 text-left ring-1 ring-white/[0.06] transition hover:bg-card hover:ring-brand/35"
            >
              <div className="flex w-full items-baseline">
                <span className="text-[14px] font-semibold text-ink/90">Unit {u.no}</span>
                <span className="tabnum ml-auto text-[10.5px] text-muted/45">
                  {sentencesOf(u.no)} 句
                </span>
              </div>
              <div className="mt-1 line-clamp-1 text-[11px] text-muted/55">{u.theme}</div>

              <div className="mt-auto">
                <div className="mb-2 flex items-center justify-between text-[10px]">
                  {unitProgress(u.no) ? (
                    <span className="text-ok/80">正确率 {unitProgress(u.no)!.acc}%</span>
                  ) : (
                    <span className="text-muted/35">未开始</span>
                  )}
                  <span className="text-brand/0 transition group-hover:text-brand/80">开始 ›</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const p = unitProgress(u.no)
                    const on = p ? i < Math.round((p.acc / 100) * 12) : false
                    return (
                      <span
                        key={i}
                        className={clsx(
                          'h-[3px] flex-1 rounded-full transition',
                          on ? 'bg-ok/60' : 'bg-white/[0.07] group-hover:bg-white/[0.12]',
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 底部状态 */}
        <div className="mt-auto flex items-center justify-center gap-6 pt-5 text-[11px] text-muted/40">
          <span className="flex items-center gap-1.5">
            <Flame
              size={12}
              strokeWidth={2}
              className={streak > 0 ? 'text-brand/70' : 'text-muted/25'}
            />
            连续 {streak} 天
          </span>
          <span className="h-3 w-px bg-white/[0.08]" />
          <span>已完成 {finished} 个单元</span>
          <span className="h-3 w-px bg-white/[0.08]" />
          <span>{avgAcc === null ? '正确率 —' : `平均正确率 ${avgAcc}%`}</span>
        </div>
      </div>
    </div>
  )
}
