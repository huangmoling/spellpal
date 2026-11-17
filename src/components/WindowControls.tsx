import { Minus, Square, X } from 'lucide-react'

export default function WindowControls() {
  const api = window.spellpal
  if (!api) return null

  const base =
    'flex h-14 w-11 items-center justify-center text-muted/70 transition hover:bg-white/[0.06] hover:text-ink'

  return (
    <div
      className="fixed right-0 top-0 z-50 flex items-center"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button className={base} onClick={api.minimize} title="最小化">
        <Minus size={15} strokeWidth={2} />
      </button>
      <button className={base} onClick={api.maximize} title="最大化">
        <Square size={11} strokeWidth={2.2} />
      </button>
      <button
        className="flex h-14 w-11 items-center justify-center text-muted/70 transition hover:bg-err/80 hover:text-white"
        onClick={api.close}
        title="关闭"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
