import { useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Flame,
  GitBranch,
  Heart,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'
import type { Book } from '@/types'
import { useApp } from '@/store/useApp'
import { loadProgress, streakDays } from '@/utils/progress'
import { dueCards, cardCount } from '@/utils/srs'
import { noticeLines, openRepo, repoUrl } from '@/core/notice'

/** 每套教材各有一块常驻的彩色底，孩子靠颜色就能找到自己的书 */
const SERIES: { key: string; label: string; emoji: string; tint: string; pub?: string }[] = [
  { key: 'starter', label: '启蒙', emoji: '🧸', tint: '#2FC49A' },
  { key: 'pep', label: '人教 PEP', emoji: '📚', tint: '#4A80F0', pub: '人民教育' },
  { key: 'fltrp', label: '外研 新标准', emoji: '🎈', tint: '#FF9A3D', pub: '外语教学' },
  { key: 'yilin', label: '译林 牛津', emoji: '📘', tint: '#9B7BF0', pub: '译林' },
  { key: 'jj', label: '冀教', emoji: '🍎', tint: '#FF7EB6', pub: '河北教育' },
  { key: 'cj', label: '川教', emoji: '🐄', tint: '#3FBFE0', pub: '四川教育' },
  { key: 'qh', label: '清华', emoji: '🎒', tint: '#7E72E8', pub: '清华大学' },
  { key: 'hj', label: '沪教', emoji: '🌈', tint: '#F0A23A', pub: '上海教育' },
  { key: 'xs', label: '湘少', emoji: '🎏', tint: '#56C596', pub: '湖南少年儿童' },
  { key: 'ls', label: '辽师大', emoji: '🌤', tint: '#FF8A5C', pub: '辽宁师范' },
]

/** 单元磁贴配色，按单元号轮转；都是糖果色里偏深的一档，压得住白字 */
const UNIT_COLORS = [
  '#4A80F0',
  '#FF9A3D',
  '#2FC49A',
  '#FF7EB6',
  '#9B7BF0',
  '#3FBFE0',
  '#F0A23A',
  '#FF7A6B',
]
const unitColor = (no: number) => UNIT_COLORS[(no - 1) % UNIT_COLORS.length]

export default function BookShelf({
  books,
  bookId,
  onPickBook,
  onOpenSettings,
}: {
  books: Book[]
  bookId: string
  onPickBook: (id: string) => void
  onOpenSettings: () => void
}) {
  const book = books.find((b) => b.id === bookId) ?? books[0]
  const startUnit = useApp((s) => s.startUnit)
  const startReview = useApp((s) => s.startReview)

  /** 每单元的句子数，单元卡片和「继续练习」都用它 */
  const sentencesOf = (no: number) => (book.sentences ?? []).filter((s) => s.unit === no).length
  const sentenceCount = (book.sentences ?? []).length
  const wordsOf = (no: number) => book.words.filter((w) => w.unit === no).length
  /** 粗估课时：一个词约 15 秒，一句约 30 秒 */
  const minutesOf = (no: number) =>
    Math.max(2, Math.round((wordsOf(no) * 15 + sentencesOf(no) * 30) / 60))

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

  const groups = SERIES.map((s) => ({
    ...s,
    list: books.filter((b) => {
      if (s.key === 'starter') return b.stage === 'starter'
      if (b.stage === 'starter') return false
      /* 出版社分开认，别再互相兜底：以前非外研的全塞给人教，加了译林就会串组 */
      return !!s.pub && b.publisher.includes(s.pub)
    }),
  })).filter((g) => g.list.length > 0)

  // 单元网格固定 4 列，行数决定网格高度上限（每行最多 142px），避免全屏时被拉高
  const unitRows = Math.max(1, Math.ceil(book.units.length / 4))

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 整页插画底：光晕 + 点阵 + 漂浮的星星/云/铅笔，缩放到任何窗口都不糊 */}
      <HomeBackdrop />

      {/* 顶栏 */}
      <header
        className="relative z-10 flex h-[56px] shrink-0 items-center pl-8"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand shadow-[0_6px_18px_rgba(255,154,61,0.45)]">
            <span className="font-mono text-[17px] font-bold text-white">S</span>
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-wide">小拼手</div>
            <div className="text-[10px] tracking-[0.2em] text-muted/55">SPELLPAL</div>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="no-drag ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-veil/5 hover:text-ink"
          title="设置"
        >
          <Settings size={19} strokeWidth={1.9} />
        </button>
        {/* 给窗口三个系统按钮留出 no-drag 空间：padding 挡不住拖拽区，必须放真元素 */}
        <div
          className="no-drag h-full w-[132px] shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
      </header>

      {/* 内容区 */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col overflow-y-auto px-8 pb-3">
        {/* 教材切换：启蒙 / 人教 PEP / 外研新标准 各一行，每行有常驻底色 */}
        {books.length > 1 && (
          <div className="flex shrink-0 flex-col gap-1">
            {groups.map((g) => {
              const activeGroup = g.list.some((b) => b.id === book.id)
              return (
                <div
                  key={g.key}
                  className="relative flex flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden rounded-2xl px-3 py-[4px] ring-1 transition-colors"
                  style={{
                    background: `linear-gradient(96deg, ${g.tint}4d, ${g.tint}22 50%, ${g.tint}0d 100%)`,
                    ['--tw-ring-color' as string]: activeGroup ? `${g.tint}90` : `${g.tint}55`,
                  }}
                >
                  <span
                    className="relative flex w-[112px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-[4px] text-[12px] font-semibold"
                    style={{ background: `${g.tint}3d` }}
                  >
                    <span className="text-[13px] leading-none">{g.emoji}</span>
                    <span className={clsx(activeGroup ? 'text-ink' : 'text-ink/70')}>{g.label}</span>
                  </span>
                  {g.list.map((b) => {
                    const on = b.id === book.id
                    const done = b.units.filter((u) => progress[`${b.id}#${u.no}`]).length
                    return (
                      <button
                        key={b.id}
                        onClick={() => onPickBook(b.id)}
                        className={clsx(
                          'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-[5px] text-[12.5px] transition',
                          on
                            ? 'bg-card font-semibold text-ink shadow-sm ring-1 ring-veil/15'
                            : 'text-ink/60 hover:bg-veil/[0.06] hover:text-ink/90',
                        )}
                      >
                        {b.shortTitle}
                        <span
                          className={clsx('tabnum text-[10.5px]', on ? 'text-brand' : 'text-ink/35')}
                        >
                          {done}/{b.units.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* 教材头部 */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-muted/60">
              <BookOpen size={13} strokeWidth={2} />
              <span>
                {book.publisher} · {book.series} · {book.edition}
              </span>
            </div>
            <h1 className="text-[35px] font-bold leading-none tracking-wide">
              {book.shortTitle}
            </h1>
          </div>
          <div className="text-right leading-none">
            <div className="tabnum text-[38px] font-bold leading-none text-brand">
              {book.wordCount}
            </div>
            <div className="mt-1.5 text-[11.5px] text-muted/55">
              个单词 · {book.units.length} 个单元 · {sentenceCount} 句
            </div>
          </div>
        </div>

        {/* 继续练习 */}
        <button
          onClick={() => openUnit(lastUnit)}
          className="group relative mt-3 w-full shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-brand/[0.12] via-card to-card px-7 py-2.5 text-left ring-1 ring-brand/25 transition hover:ring-brand/50"
        >
          <div className="absolute -right-8 -top-20 h-56 w-56 rounded-full bg-brand/18 blur-2xl transition group-hover:bg-brand/28" />
          <CardScene />
          <div className="relative flex items-center gap-5">
            <div className="flex-1">
              <div className="mb-0.5 flex items-center gap-1.5 text-[11.5px] text-brand/90">
                <Sparkles size={13} strokeWidth={2.4} />
                {unitProgress(lastUnitData.no) ? '再练一次' : '继续练习'}
              </div>
              <div className="text-[26px] font-bold leading-tight">Unit {lastUnitData.no}</div>
              <div className="mt-0.5 text-[12.5px] text-muted/70">
                {lastUnitData.theme} · {wordsOf(lastUnitData.no)} 词 ·{' '}
                {sentencesOf(lastUnitData.no)} 句 · 约 {minutesOf(lastUnitData.no)} 分钟
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted transition group-hover:text-ink">开始</span>
              <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_26px_rgba(74,128,240,0.5)] transition group-hover:scale-105">
                <ArrowRight size={22} strokeWidth={2.4} />
              </span>
            </div>
          </div>
        </button>

        {/* 错题本 */}
        <button
          onClick={reviewNow}
          disabled={cardsTotal === 0}
          className={clsx(
            'group mt-2 flex shrink-0 items-center gap-3.5 rounded-2xl px-5 py-1.5 text-left ring-1 transition',
            cardsTotal === 0
              ? 'cursor-default bg-veil/[0.03] ring-veil/[0.07]'
              : 'bg-veil/[0.04] ring-veil/[0.09] hover:bg-card hover:ring-brand/35',
          )}
        >
          <span
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              due.length > 0 ? 'bg-err/15 text-err/90' : 'bg-veil/[0.05] text-muted/50',
            )}
          >
            <CalendarClock size={18} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-[14.5px] font-semibold text-ink/90">错题本</span>
              <span className="tabnum text-[11.5px] text-muted/50">{cardsTotal} 条</span>
              {due.length > 0 && (
                <span className="rounded-md bg-err/15 px-1.5 py-[1px] text-[11px] text-err/90">
                  {due.length} 待复习
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-[12px] text-muted/55">
              {cardsTotal === 0
                ? '还没有错句，练完一个单元会自动收集'
                : due.length > 0
                  ? '按 1、3、7、16 天的节奏复习，打对的会自动移出'
                  : '今天没有要复习的句子，明天再来'}
            </span>
          </span>
          {cardsTotal > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-brand/80">
              {due.length > 0 ? '开始复习' : '全部复习'}
              <ArrowRight size={14} strokeWidth={2.4} />
            </span>
          )}
        </button>

        {/* 单元标题 */}
        <div className="mb-2 mt-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink/80">全部单元</h2>
          <span className="text-[11.5px] text-muted/45">
            <Layers size={11} strokeWidth={2.4} className="mr-1 inline" />
            一个单词，一个句子
          </span>
        </div>

        {/* 单元网格 + 底部插画带：网格吃掉剩余高度，插画带收住空旷感 */}
        {/*
         * 行高用 1fr 跟着剩余高度走，但给网格整体压一个上限（每行最多 142px）。
         * 之前没有上限，1080p 全屏时一行被拉到 240px，格子变成一片色块，孩子看不出是卡片。
         */}
        <div
          className="grid flex-1 auto-rows-[minmax(104px,1fr)] grid-cols-4 gap-3"
          style={{ maxHeight: unitRows * 142 + (unitRows - 1) * 12 }}
        >
          {book.units.map((u) => {
            const c = unitColor(u.no)
            const p = unitProgress(u.no)
            return (
              <button
                key={u.no}
                onClick={() => openUnit(u.no)}
                className="group relative flex flex-col overflow-hidden rounded-2xl p-3 text-left ring-1 transition duration-150 hover:-translate-y-[1px] hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.55)]"
                style={{
                  background: `linear-gradient(150deg, ${c}4d, ${c}1c)`,
                  ['--tw-ring-color' as string]: `${c}66`,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-5 -right-2 h-16 w-16 rounded-full opacity-25 blur-xl transition group-hover:opacity-40"
                  style={{ background: c }}
                />
                <div className="relative flex w-full items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[13.5px] font-bold text-white shadow-sm"
                    style={{ background: c }}
                  >
                    {u.no}
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-ink/45">
                    UNIT
                  </span>
                  <span className="tabnum ml-auto text-[11px] text-ink/50">
                    {wordsOf(u.no)} 词 · {sentencesOf(u.no)} 句
                  </span>
                </div>
                <div className="relative mt-1 line-clamp-1 text-[15.5px] font-semibold text-ink/85">
                  {u.theme}
                </div>

                <div className="relative mt-auto">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    {p ? (
                      <span className="font-medium text-ok">正确率 {p.acc}%</span>
                    ) : (
                      <span className="text-ink/45">未开始</span>
                    )}
                    <span className="text-brand/0 transition group-hover:text-brand/85">开始 ›</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const on = p ? i < Math.round((p.acc / 100) * 12) : false
                      return (
                        <span
                          key={i}
                          className="h-[4px] flex-1 rounded-full transition"
                          style={{ background: on ? c : 'rgb(var(--veil) / 0.22)' }}
                        />
                      )
                    })}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* 底部状态 */}
        <div className="mt-auto flex shrink-0 items-center justify-center gap-6 pt-2.5 text-[12.5px] text-muted/70">
          <span className="flex items-center gap-1.5">
            <Flame
              size={13}
              strokeWidth={2}
              className={streak > 0 ? 'text-brand/70' : 'text-muted/25'}
            />
            连续 {streak} 天
          </span>
          <span className="h-3 w-px bg-veil/[0.08]" />
          <span>已完成 {finished} 个单元</span>
          <span className="h-3 w-px bg-veil/[0.08]" />
          <span>{avgAcc === null ? '正确率 —' : `平均正确率 ${avgAcc}%`}</span>
        </div>

        {/* 声明 */}
        <NoticeCard />
      </div>
    </div>
  )
}

/** 首页底部的免费开源声明。文案不写成明文常量，见 core/notice.ts */
function NoticeCard() {
  const [head, body] = noticeLines()
  return (
    <div className="mb-1 mt-2 flex shrink-0 items-center gap-2.5 rounded-xl bg-veil/[0.02] px-3.5 py-1.5 ring-1 ring-veil/[0.05]">
      <Heart size={12} strokeWidth={2.2} className="shrink-0 text-err/70" />
      <span className="shrink-0 text-[11px] font-medium text-ink/70">{head}</span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted/40">{body}</span>
      <button
        onClick={openRepo}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-veil/[0.04] px-2 py-1 text-[10.5px] text-muted/70 ring-1 ring-veil/[0.06] transition hover:bg-brand/10 hover:text-brand hover:ring-brand/40"
        title="在浏览器中打开项目主页"
      >
        <GitBranch size={10} strokeWidth={2.2} />
        <span className="font-mono">{repoUrl().replace(/^https:\/\//, '')}</span>
        <ArrowUpRight size={10} strokeWidth={2.6} />
      </button>
    </div>
  )
}

/**
 * 整页插画底：四团柔光 + 点阵 + 几颗漂浮的星星。
 * 纯 SVG，跟窗口一起缩放，不占体积也不会糊。
 */
function HomeBackdrop() {
  const theme = useApp((s) => s.theme)
  const light = theme === 'light'
  const ink = light ? 'rgb(15,23,42)' : 'rgb(255,255,255)'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <radialGradient id="bdPurple">
            <stop offset="0%" stopColor="#FF9A3D" stopOpacity={light ? '0.22' : '0.22'} />
            <stop offset="100%" stopColor="#FF9A3D" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bdTeal">
            <stop offset="0%" stopColor="#4A80F0" stopOpacity={light ? '0.2' : '0.2'} />
            <stop offset="100%" stopColor="#4A80F0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bdAmber">
            <stop offset="0%" stopColor="#2FC49A" stopOpacity={light ? '0.18' : '0.2'} />
            <stop offset="100%" stopColor="#2FC49A" stopOpacity="0" />
          </radialGradient>
          <pattern id="bdDots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.5" fill={ink} fillOpacity={light ? '0.10' : '0.075'} />
          </pattern>
        </defs>

        <rect width="1200" height="800" fill="url(#bdDots)" />
        <ellipse cx="90" cy="40" rx="420" ry="290" fill="url(#bdPurple)" />
        <ellipse cx="1130" cy="110" rx="400" ry="280" fill="url(#bdTeal)" />
        <ellipse cx="1080" cy="770" rx="420" ry="300" fill="url(#bdAmber)" />
        <ellipse cx="130" cy="740" rx="380" ry="260" fill="url(#bdTeal)" opacity="0.7" />

        <g fill="#FFB020" fillOpacity={light ? '0.55' : '0.42'}>
          {[
            [60, 210, 7],
            [1150, 300, 5],
            [1168, 520, 8],
            [46, 470, 5],
          ].map(([x, y, r], i) => (
            <path
              key={i}
              transform={`translate(${x} ${y}) scale(${r / 8})`}
              d="M0 -8 L2.3 -2.3 L8 0 L2.3 2.3 L0 8 L-2.3 2.3 L-8 0 L-2.3 -2.3 Z"
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

/**
 * 「继续练习」卡片右半边的空地上放几笔线描涂鸦：云、纸飞机、星星、一摞书。
 * 卡片很宽，纯文字会显得空；线描比大色块安静，不会抢「开始」按钮。
 */
function CardScene() {
  const theme = useApp((s) => s.theme)
  const light = theme === 'light'
  const ink = light ? '#334155' : '#E2E8F0'
  return (
    <svg
      aria-hidden
      viewBox="0 0 520 110"
      preserveAspectRatio="xMaxYMid meet"
      className="pointer-events-none absolute right-[146px] top-1/2 hidden h-[92px] w-[440px] -translate-y-1/2 min-[1080px]:block"
      style={{ opacity: light ? 0.4 : 0.34 }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 云 */}
      <path
        d="M18 62 a13 13 0 0 1 13 -13 a15 15 0 0 1 28 4 a10 10 0 0 1 -2 19 h-26 a11 11 0 0 1 -13 -10 z"
        stroke={ink}
        strokeWidth="2.2"
      />
      {/* 纸飞机 */}
      <path d="M104 82 L146 58 L136 92 L127 78 Z" stroke="#4A80F0" strokeWidth="2.4" />
      <path d="M146 58 L127 78" stroke="#4A80F0" strokeWidth="1.8" opacity="0.65" />
      <path d="M104 82 L92 88" stroke="#4A80F0" strokeWidth="1.8" opacity="0.4" />

      {/* 星星 */}
      <path
        d="M228 30 l4.4 10.2 10.2 4.4 -10.2 4.4 -4.4 10.2 -4.4 -10.2 -10.2 -4.4 10.2 -4.4 z"
        stroke="#FF9A3D"
        strokeWidth="2.2"
      />
      <path
        d="M286 74 l2.8 6.6 6.6 2.8 -6.6 2.8 -2.8 6.6 -2.8 -6.6 -6.6 -2.8 6.6 -2.8 z"
        stroke="#FF7EB6"
        strokeWidth="2"
      />
      <circle cx="336" cy="34" r="3.4" stroke="#3FBFE0" strokeWidth="2" />

      {/* 一摞书 */}
      <g stroke="#3FBFE0" strokeWidth="2.2">
        <path d="M392 90 h40 a4 4 0 0 1 4 4 v7 h-44 z" />
        <path d="M397 74 h40 a4 4 0 0 1 4 4 v7 h-44 z" />
        <path d="M402 58 h40 a4 4 0 0 1 4 4 v7 h-44 z" />
      </g>
      {/* 铅笔 */}
      <g transform="translate(452 30) rotate(18)" stroke="none">
        <rect width="14" height="44" rx="3" fill="#FFB020" fillOpacity="0.55" />
        <path d="M0 44 L7 56 L14 44 Z" fill="#FDE7C8" fillOpacity="0.8" />
        <rect x="0" y="-6" width="14" height="7" rx="3" fill="#FF7EB6" fillOpacity="0.6" />
      </g>
    </svg>
  )
}
