import { useEffect } from 'react'
import clsx from 'clsx'
import { Delete, Lock } from 'lucide-react'

/**
 * 6 位数字密码输入：6 个方格 + 鼠标可点的数字键盘。
 *
 * 键盘事件挂在 window 捕获阶段：弹窗出现时底下的练习页/书架也在监听按键，
 * 不截掉的话输密码会顺带把字母打进句子。
 */
export default function PinPad({
  value,
  onChange,
  onComplete,
  onCancel,
  disabled,
  error,
}: {
  value: string
  onChange: (v: string) => void
  /** 输满 6 位自动调用 */
  onComplete?: (v: string) => void
  onCancel?: () => void
  disabled?: boolean
  /** 上一次输错，方框整体标红 */
  error?: boolean
}) {
  const press = (k: string) => {
    if (disabled) return
    if (k === 'del') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length >= 6) return
    const next = value + k
    onChange(next)
    if (next.length === 6) onComplete?.(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return
      /* 输密码期间底下页面一个键都别想吃 */
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
        return
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        press(e.key)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        press('del')
        return
      }
      if (e.key === 'Enter' && value.length === 6) {
        e.preventDefault()
        onComplete?.(value)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  return (
    <div className="flex flex-col items-center">
      {/* 6 个方格 */}
      <div data-pin-input className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < value.length
          const active = i === value.length && !disabled
          return (
            <div
              key={i}
              className={clsx(
                'tabnum flex h-[52px] w-[42px] items-center justify-center rounded-xl text-[22px] font-semibold transition',
                error
                  ? 'bg-err/10 text-err ring-1 ring-err/45'
                  : filled
                    ? 'bg-brand/12 text-ink ring-1 ring-brand/35'
                    : 'bg-veil/[0.05] text-ink/80 ring-1 ring-veil/[0.09]',
                active && !error && 'ring-2 ring-brand/70',
              )}
            >
              {filled ? (
                value[i]
              ) : active ? (
                <span className="h-[3px] w-[3px] rounded-full bg-brand" />
              ) : (
                ''
              )}
            </div>
          )
        })}
      </div>

      {/* 数字键盘 */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={disabled}
            className="tabnum h-12 w-[92px] rounded-xl bg-veil/[0.05] text-[17px] font-medium text-ink/85 ring-1 ring-veil/[0.07] transition hover:bg-veil/[0.1] active:scale-[0.97] disabled:opacity-40"
          >
            {k}
          </button>
        ))}
        <span className="flex h-12 w-[92px] items-center justify-center">
          <Lock size={12} strokeWidth={1.6} className="text-muted/20" />
        </span>
        <button
          type="button"
          onClick={() => press('0')}
          disabled={disabled}
          className="tabnum h-12 w-[92px] rounded-xl bg-veil/[0.05] text-[17px] font-medium text-ink/85 ring-1 ring-veil/[0.07] transition hover:bg-veil/[0.1] active:scale-[0.97] disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => press('del')}
          disabled={disabled}
          title="删除一位（Backspace）"
          className="flex h-12 w-[92px] items-center justify-center rounded-xl bg-veil/[0.05] text-muted/70 ring-1 ring-veil/[0.07] transition hover:bg-veil/[0.1] hover:text-ink active:scale-[0.97] disabled:opacity-40"
        >
          <Delete size={17} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  )
}
