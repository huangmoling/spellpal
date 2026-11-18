import { Minus, Square, X } from 'lucide-react'

/**
 * 无边框窗口的三个系统按钮。
 *
 * 注意：模块里三处「拖拽区留白」必须用真正的 no-drag 元素，不能用 padding ——
 * `-webkit-app-region` 作用于整个元素盒，padding 也算拖拽区，
 * 于是点击会被 Windows 当成「拖标题栏」，按钮看起来完全没反应。
 */
export default function WindowControls() {
  const api = window.spellpal
  if (!api) return null

  const base =
    'no-drag flex h-14 w-11 items-center justify-center text-muted/70 transition hover:bg-veil/[0.06] hover:text-ink'

  return (
    <div
      className="no-drag fixed right-0 top-0 z-[999] flex items-center"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button type="button" className={base} onClick={() => api.minimize()} title="最小化">
        <Minus size={15} strokeWidth={2} />
      </button>
      <button type="button" className={base} onClick={() => api.maximize()} title="最大化">
        <Square size={11} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className="no-drag flex h-14 w-11 items-center justify-center text-muted/70 transition hover:bg-err/80 hover:text-white"
        onClick={() => api.close()}
        title="关闭"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
