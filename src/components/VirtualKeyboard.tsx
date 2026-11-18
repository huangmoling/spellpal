import clsx from 'clsx'
import { Delete } from 'lucide-react'
import { useApp } from '@/store/useApp'

/** 八个手指 + 拇指，各自一个颜色，孩子看着颜色就知道该用哪根手指。
 *  color 给暗色主题（浅色调），light 给浅色主题（压深保证在白底上看得清）。 */
const FINGERS = {
  l1: { name: '左手小指', color: '#f9a8d4', light: '#db2777' },
  l2: { name: '左手无名指', color: '#fdba74', light: '#ea580c' },
  l3: { name: '左手中指', color: '#fde047', light: '#a16207' },
  l4: { name: '左手食指', color: '#86efac', light: '#15803d' },
  r4: { name: '右手食指', color: '#7dd3fc', light: '#0284c7' },
  r3: { name: '右手中指', color: '#a5b4fc', light: '#4f46e5' },
  r2: { name: '右手无名指', color: '#d8b4fe', light: '#9333ea' },
  r1: { name: '右手小指', color: '#fca5a5', light: '#dc2626' },
  thumb: { name: '拇指', color: '#cbd5e1', light: '#475569' },
} as const

type Finger = (typeof FINGERS)[keyof typeof FINGERS]
const fingerColor = (f: Finger, light: boolean) => (light ? f.light : f.color)

type FingerId = keyof typeof FINGERS

const ROWS: { keys: [string, FingerId][]; offset: number }[] = [
  {
    offset: 0,
    keys: [
      ['q', 'l1'],
      ['w', 'l2'],
      ['e', 'l3'],
      ['r', 'l4'],
      ['t', 'l4'],
      ['y', 'r4'],
      ['u', 'r4'],
      ['i', 'r3'],
      ['o', 'r2'],
      ['p', 'r1'],
    ],
  },
  {
    offset: 18,
    keys: [
      ['a', 'l1'],
      ['s', 'l2'],
      ['d', 'l3'],
      ['f', 'l4'],
      ['g', 'l4'],
      ['h', 'r4'],
      ['j', 'r4'],
      ['k', 'r3'],
      ['l', 'r2'],
    ],
  },
  {
    offset: 42,
    keys: [
      ['z', 'l1'],
      ['x', 'l2'],
      ['c', 'l3'],
      ['v', 'l4'],
      ['b', 'l4'],
      ['n', 'r4'],
      ['m', 'r4'],
    ],
  },
]

const FINGER_OF: Record<string, FingerId> = Object.fromEntries(
  ROWS.flatMap((r) => r.keys),
)

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

interface Props {
  /** 下一个要敲的字符（小写字母），没有则为 null */
  nextKey: string | null
  className?: string
}

export default function VirtualKeyboard({ nextKey, className }: Props) {
  const light = useApp((s) => s.theme) === 'light'
  const finger = nextKey ? FINGERS[FINGER_OF[nextKey] ?? 'l4'] : null
  const fingerTone = finger ? fingerColor(finger, light) : null

  return (
    <div
      data-kb
      className={clsx(
        'shrink-0 rounded-2xl bg-veil/[0.022] px-4 py-2.5 ring-1 ring-veil/[0.05]',
        className,
      )}
    >
      <div className="flex items-center justify-center gap-7">
        {/* 指法提示 */}
        <div className="w-[124px] shrink-0 text-right">
          <div className="text-[10.5px] leading-none text-muted/45">下一个键</div>
          <div className="mt-1 flex items-baseline justify-end gap-1.5">
            <span
              className="font-mono text-[26px] font-bold uppercase leading-none"
              style={{ color: fingerTone ?? 'rgb(var(--muted) / 0.45)' }}
            >
              {nextKey ?? '·'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span
              className="h-[6px] w-[6px] shrink-0 rounded-full"
              style={{ background: fingerTone ?? 'rgb(var(--muted) / 0.3)' }}
            />
            <span className="truncate text-[11px] text-muted/70">{finger?.name ?? '不用敲'}</span>
          </div>
        </div>

        {/* 键盘本体 */}
        <div className="flex flex-col gap-[5px]">
          {ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-[5px]" style={{ marginLeft: row.offset }}>
              {row.keys.map(([k, f]) => {
                const c = fingerColor(FINGERS[f], light)
                const on = nextKey === k
                return (
                  <Key key={k} color={c} light={light} active={on} title={`${k.toUpperCase()} · ${FINGERS[f].name}`}>
                    {k.toUpperCase()}
                    {(k === 'f' || k === 'j') && (
                      <span
                        className="pointer-events-none absolute bottom-[3px] left-1/2 h-[2px] w-[9px] -translate-x-1/2 rounded-full"
                        style={{ background: on ? 'rgba(8,8,14,0.5)' : rgba(c, 0.75) }}
                      />
                    )}
                  </Key>
                )
              })}
              {ri === 2 && (
                <>
                  <Key color={fingerColor(FINGERS.r1, light)} light={light} active={false} title="退格 · 删掉一个字母">
                    <Delete size={13} strokeWidth={2.4} className="mx-auto" />
                  </Key>
                  <Key color={fingerColor(FINGERS.r1, light)} light={light} active={false} title="回车 · 跳过整句">
                    <span className="text-[9.5px] tracking-tight">Enter</span>
                  </Key>
                </>
              )}
            </div>
          ))}

          {/* 空格 */}
          <div className="flex gap-[5px] pl-[42px]">
            <Key
              color={fingerColor(FINGERS.thumb, light)}
              light={light}
              active={nextKey === ' '}
              title="空格 · 放弃当前这个词"
              className="!w-[296px] !h-[22px]"
            >
              <span className="text-[9.5px] tracking-[0.18em]">SPACE</span>
            </Key>
          </div>
        </div>

        {/* 右手留白，让键盘视觉居中 */}
        <div className="w-[124px] shrink-0" />
      </div>
    </div>
  )
}

function Key({
  children,
  color,
  active,
  title,
  className,
  light = false,
}: {
  children: React.ReactNode
  color: string
  active: boolean
  title: string
  className?: string
  light?: boolean
}) {
  return (
    <div
      title={title}
      className={clsx(
        'relative flex h-[30px] w-[38px] items-center justify-center rounded-[7px] text-[13px] font-semibold leading-none transition-all duration-150',
        className,
      )}
      style={{
        background: active ? color : rgba(color, light ? 0.16 : 0.09),
        color: active ? '#08080e' : rgba(color, light ? 0.92 : 0.72),
        boxShadow: active
          ? `0 0 0 2px ${rgba(color, 0.9)}, 0 0 20px ${rgba(color, 0.45)}, 0 4px 10px rgba(0,0,0,0.35)`
          : `inset 0 0 0 1px ${rgba(color, light ? 0.3 : 0.2)}`,
        transform: active ? 'translateY(-1px) scale(1.06)' : undefined,
      }}
    >
      {children}
    </div>
  )
}
