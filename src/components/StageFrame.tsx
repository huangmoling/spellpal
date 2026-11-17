import type { ReactNode } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  EyeOff,
  Maximize2,
  RotateCcw,
  Settings,
  SkipForward,
} from 'lucide-react'

/* ---------- 顶栏 ---------- */

export function TopBar({
  title,
  unitLabel,
  onBack,
  onSettings,
  right,
}: {
  title: string
  unitLabel?: string
  onBack: () => void
  onSettings?: () => void
  right?: ReactNode
}) {
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <button
        onClick={onBack}
        className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
        aria-label="返回"
      >
        <ChevronLeft size={20} strokeWidth={2.2} />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[13px] text-muted">{title}</span>
        {unitLabel && (
          <span className="shrink-0 rounded-md border border-brand/35 bg-brand/15 px-2 py-[3px] text-[12px] font-medium text-brand">
            {unitLabel}
          </span>
        )}
      </div>

      <div className="no-drag ml-auto flex items-center gap-0.5 pr-[118px]">
        {right}
        {[
          { icon: CreditCard, label: '词卡' },
          { icon: RotateCcw, label: '重练' },
          { icon: Maximize2, label: '全屏' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            title={label}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
          >
            <Icon size={16} strokeWidth={1.9} />
          </button>
        ))}
        <button
          onClick={onSettings}
          title="设置"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
        >
          <Settings size={16} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  )
}

/* ---------- 进度条 ---------- */

export function ProgressBar({
  done,
  total,
  timeText,
  label = '已练题',
}: {
  done: number
  total: number
  timeText: string
  label?: string
}) {
  const pct = total ? Math.min(100, (done / total) * 100) : 0
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 px-5">
      <span className="tabnum shrink-0 text-[11px] text-muted">
        {label} <span className="text-ink/80">{done}</span>/{total}
      </span>
      <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(124,92,255,0.55)' }}
        />
      </div>
      <span className="tabnum shrink-0 text-[11px] text-muted">{timeText}</span>
    </div>
  )
}

/* ---------- 底部工具栏 ---------- */

export function BottomBar({
  onPrev,
  onSkip,
  onNext,
  onReveal,
  onMaster,
  extra,
  hintLeft,
}: {
  onPrev?: () => void
  onSkip?: () => void
  onNext?: () => void
  onReveal?: () => void
  onMaster?: () => void
  extra?: ReactNode
  hintLeft?: ReactNode
}) {
  const iconBtn =
    'flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/[0.07] hover:text-ink'

  return (
    <footer className="grid h-[68px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
      <div className="flex min-w-0 items-center text-[12px] text-muted/60">{hintLeft}</div>

      <div className="flex items-center gap-1 rounded-2xl bg-card/80 px-2 py-1.5 ring-1 ring-white/[0.06] backdrop-blur">
        <button className={iconBtn} onClick={onPrev} title="上一题">
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <button className={iconBtn} onClick={onSkip} title="跳过（Enter）">
          <SkipForward size={17} strokeWidth={2} />
        </button>
        <button className={iconBtn} onClick={onReveal} title="显示答案">
          <EyeOff size={17} strokeWidth={2} />
        </button>
        {extra}
        <button className={iconBtn} onClick={onMaster} title="标记已掌握，移出错题本">
          <Check size={17} strokeWidth={2.4} />
        </button>

        <button
          onClick={onNext}
          className="ml-1 h-9 rounded-xl bg-brand px-5 text-[13px] font-medium leading-none text-white shadow-[0_4px_18px_rgba(124,92,255,0.4)] transition hover:brightness-110 active:scale-[0.98]"
        >
          下一题
        </button>

        <button className={iconBtn} onClick={onNext} title="下一题">
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex justify-end">
        <span className="text-[11px] text-muted/35">Esc 返回</span>
      </div>
    </footer>
  )
}

/* ---------- 页面骨架 ---------- */

export function StageFrame({ children }: { children: ReactNode }) {
  return <div className="relative flex h-full flex-col">{children}</div>
}
