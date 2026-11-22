import { useMemo } from 'react'
import { ArrowRight, CalendarClock, Settings } from 'lucide-react'
import clsx from 'clsx'
import type { Book } from '@/types'
import { useApp } from '@/store/useApp'
import { loadProgress } from '@/utils/progress'
import { dueCards, cardCount } from '@/utils/srs'

/** 每套教材各有一块常驻的彩色底，孩子靠颜色就能找到自己的书 */
const SERIES: { key: string; label: string; emoji: string; tint: string; pub?: string }[] = [
  { key: 'starter', label: '启蒙', emoji: '🧸', tint: '#2FC49A' },
  { key: 'pep', label: '人教 PEP', emoji: '📚', tint: '#4A80F0', pub: '人民教育' },
  { key: 'fltrp', label: '外研 新标准', emoji: '🎈', tint: '#FF9A3D', pub: '外语教学' },
  { key: 'yilin', label: '牛津译林', emoji: '📘', tint: '#9B7BF0', pub: '译林' },
  { key: 'bj', label: '北京版', emoji: '🏙', tint: '#E8606C', pub: '北京出版社' },
  { key: 'bsd', label: '北师大', emoji: '🎓', tint: '#6C5CE7', pub: '北京师范大学' },
  { key: 'jj', label: '冀教', emoji: '🍎', tint: '#FF7EB6', pub: '河北教育' },
  { key: 'cj', label: '川教', emoji: '🐄', tint: '#3FBFE0', pub: '四川教育' },
  { key: 'jk', label: '教科', emoji: '🔬', tint: '#00B894', pub: '教育科学' },
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

/**
 * 书 → 系列 key。跟 SERIES 的分组规则同源，出版社分开认，别再互相兜底：
 * 以前非外研的全塞给人教，加了译林就会串组。
 */
const seriesKeyOf = (b: Book): string | undefined => {
  if (b.stage === 'starter') return 'starter'
  return SERIES.find((s) => s.pub && b.publisher.includes(s.pub))?.key
}

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

  const lastUnit = Number(localStorage.getItem(`spellpal:last-unit:${book.id}`) || 1)
  const lastUnitData = book.units.find((u) => u.no === lastUnit) ?? book.units[0]

  const progress = useMemo(() => loadProgress(), [book.id])
  const unitProgress = (no: number) => progress[`${book.id}#${no}`]

  const due = useMemo(() => dueCards(book.id), [book.id])
  const cardsTotal = useMemo(() => cardCount(book.id), [book.id])

  /** 系列行 + 教材行：选中的书 = 下面单元格所属的书，全页只有一份选中态 */
  const groups = useMemo(
    () =>
      SERIES.map((s) => ({
        ...s,
        list: books.filter((b) => seriesKeyOf(b) === s.key),
      })).filter((g) => g.list.length > 0),
    [books],
  )
  const activeKey = seriesKeyOf(book) ?? groups[0]?.key ?? ''
  const bookRow = groups.find((g) => g.key === activeKey)?.list ?? []

  const pickBook = (id: string) => {
    const b = books.find((x) => x.id === id)
    const k = b && seriesKeyOf(b)
    if (k) localStorage.setItem(`spellpal:last-book:${k}`, id)
    onPickBook(id)
  }

  /** 点系列只换教材行；换书时优先回到这个系列上次用的那本 */
  const pickSeries = (key: string) => {
    if (key === activeKey) return
    const g = groups.find((x) => x.key === key)
    if (!g) return
    const last = localStorage.getItem(`spellpal:last-book:${key}`)
    pickBook(g.list.find((b) => b.id === last)?.id ?? g.list[0].id)
  }

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

  // 单元网格固定 4 列，行数决定网格高度上限（每行最多 142px），避免全屏时被拉高
  const unitRows = Math.max(1, Math.ceil(book.units.length / 4))

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 整页插画底：光晕 + 点阵 + 漂浮的星星，缩放到任何窗口都不糊 */}
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
          <div className="text-[17px] font-bold tracking-wide">小拼手</div>
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
      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col overflow-y-auto px-8 pb-4">
        {/* 系列 / 教材切换 */}
        {books.length > 1 && (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {groups.map((g) => {
                const on = g.key === activeKey
                return (
                  <button
                    key={g.key}
                    onClick={() => pickSeries(g.key)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl px-4 py-2 text-[18px] transition',
                      on
                        ? 'font-semibold text-ink'
                        : 'text-ink/55 hover:bg-veil/[0.05] hover:text-ink/85',
                    )}
                    style={
                      on
                        ? {
                            background: `${g.tint}26`,
                            boxShadow: `inset 0 0 0 1.5px ${g.tint}99`,
                          }
                        : undefined
                    }
                  >
                    <span className="text-[17px] leading-none">{g.emoji}</span>
                    {g.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 flex shrink-0 flex-wrap items-center gap-1.5">
              {bookRow.map((b) => {
                const on = b.id === book.id
                return (
                  <button
                    key={b.id}
                    onClick={() => pickBook(b.id)}
                    className={clsx(
                      'whitespace-nowrap rounded-xl px-5 py-2 text-[18px] transition',
                      on
                        ? 'bg-card font-semibold text-ink shadow-sm ring-1 ring-veil/15'
                        : 'text-ink/60 hover:bg-veil/[0.06] hover:text-ink/90',
                    )}
                  >
                    {b.shortTitle}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* 当前教材 */}
        <h1 className="mt-4 text-[27px] font-bold leading-none tracking-wide">{book.shortTitle}</h1>

        {/* 继续练习 */}
        <button
          onClick={() => openUnit(lastUnitData.no)}
          className="group relative mt-3 flex w-full shrink-0 items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand/[0.12] via-card to-card px-7 py-3.5 text-left ring-1 ring-brand/25 transition hover:ring-brand/50"
        >
          <CardScene />
          <div className="flex-1">
            <div className="text-[16px] font-semibold tracking-[0.12em] text-brand/90">
              继续练习
            </div>
            <div className="mt-1 text-[21px] font-bold leading-tight">
              Unit {lastUnitData.no}
              {lastUnitData.theme ? ` · ${lastUnitData.theme}` : ''}
            </div>
          </div>
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_26px_rgba(74,128,240,0.5)] transition group-hover:scale-105">
            <ArrowRight size={21} strokeWidth={2.4} />
          </span>
        </button>

        {/* 错题本：没有错句时不占一行，练错后自动出现 */}
        {cardsTotal > 0 && (
          <button
            onClick={reviewNow}
            className="group mt-2 flex shrink-0 items-center gap-3.5 rounded-2xl bg-veil/[0.04] px-5 py-2.5 text-left ring-1 ring-veil/[0.09] transition hover:bg-card hover:ring-brand/35"
          >
            <span
              className={clsx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                due.length > 0 ? 'bg-err/15 text-err/90' : 'bg-veil/[0.05] text-muted/50',
              )}
            >
              <CalendarClock size={18} strokeWidth={2} />
            </span>
            <span className="text-[14.5px] font-semibold text-ink/90">错题本</span>
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[12.5px] text-brand/80">
              {due.length > 0 ? '开始复习' : '全部复习'}
              <ArrowRight size={14} strokeWidth={2.4} />
            </span>
          </button>
        )}

        {/* 单元网格 */}
        <div
          className="mt-3 grid flex-1 auto-rows-[minmax(104px,1fr)] grid-cols-4 gap-3"
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
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[13.5px] font-bold text-white shadow-sm"
                  style={{ background: c }}
                >
                  {u.no}
                </span>
                <div className="mt-1.5 line-clamp-2 text-[16.5px] font-semibold leading-tight tracking-[0.02em] text-ink/85">
                  {u.theme}
                </div>
                {/* 正确率就是进度条的填充量；没练过的单元不画这条线 */}
                {p && (
                  <div className="mt-auto h-1 w-full overflow-hidden rounded-full bg-veil/[0.22]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p.acc}%`, background: c }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
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
      className="pointer-events-none absolute right-[112px] top-1/2 hidden h-[80px] w-[420px] -translate-y-1/2 min-[1080px]:block"
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
