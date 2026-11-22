import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Clock, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import PinPad from '@/components/GuardPin'
import {
  GUARD_DEFAULT_MINUTES,
  GUARD_MAX_MINUTES,
  GUARD_MIN_MINUTES,
  useApp,
} from '@/store/useApp'
import { fmtDuration } from '@/core/pin'

/** 弹窗外壳：遮罩 + 卡片 + 关闭按钮 */
function Shell({
  icon,
  tone = 'brand',
  title,
  desc,
  onCancel,
  children,
}: {
  icon: React.ReactNode
  tone?: 'brand' | 'err'
  title: string
  desc: string
  onCancel: () => void
  children: React.ReactNode
}) {
  /* 没输密码那几步（比如选时长）也得能用 Esc 退出 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return (
    <div
      data-guard-modal
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-scrim/50 backdrop-blur-[3px]"
      onMouseDown={onCancel}
    >
      <div
        className="relative w-[392px] overflow-hidden rounded-3xl bg-panel p-6 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.75)] ring-1 ring-veil/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={clsx(
            'pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full blur-2xl',
            tone === 'err' ? 'bg-err/20' : 'bg-brand/20',
          )}
        />
        <button
          onClick={onCancel}
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted/60 transition hover:bg-veil/[0.07] hover:text-ink"
          title="取消（Esc）"
        >
          <X size={15} strokeWidth={2.2} />
        </button>

        <div className="relative">
          <div
            className={clsx(
              'flex h-11 w-11 items-center justify-center rounded-2xl',
              tone === 'err' ? 'bg-err/15 text-err' : 'bg-brand/15 text-brand',
            )}
          >
            {icon}
          </div>
          <h2 className="mt-3.5 text-[18px] font-bold">{title}</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted/70">{desc}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 每日学习时长滑块 */
function MinutesSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl bg-veil/[0.03] px-4 py-3 ring-1 ring-veil/[0.06]">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-muted/70">
          <Clock size={13} strokeWidth={2} />
          每天可以学
        </span>
        <span className="tabnum text-[15px] font-semibold text-brand">{value} 分钟</span>
      </div>
      <input
        type="range"
        min={GUARD_MIN_MINUTES}
        max={GUARD_MAX_MINUTES}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-veil/[0.12] accent-[rgb(var(--brand))]"
      />
      <div className="mt-2 flex justify-between text-[10.5px] text-muted/45">
        <span>{GUARD_MIN_MINUTES} 分钟</span>
        <span>{GUARD_MAX_MINUTES} 分钟</span>
      </div>
    </div>
  )
}

/**
 * 首次开启守护：设 6 位密码 → 再输一次确认 → 定每日时长。
 * 两步确认是必须的：输错的密码等于把自己锁在外面。
 */
export function PinSetupDialog({
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: () => void
}) {
  const enableGuard = useApp((s) => s.enableGuard)
  const [step, setStep] = useState<'pin' | 'confirm' | 'minutes'>('pin')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(false)
  const [minutes, setMinutes] = useState(GUARD_DEFAULT_MINUTES)

  const submitPin = (v: string) => {
    if (v.length !== 6) return
    setPin(v)
    setError(false)
    setStep('confirm')
    setConfirm('')
  }

  const submitConfirm = (v: string) => {
    if (v.length !== 6) return
    if (v !== pin) {
      setError(true)
      setConfirm('')
      return
    }
    setError(false)
    setStep('minutes')
  }

  const finish = () => {
    if (enableGuard(pin, minutes)) onDone()
    else onCancel()
  }

  if (step === 'minutes') {
    return (
      <Shell
        icon={<ShieldCheck size={20} strokeWidth={2} />}
        title="每天学多久？"
        desc="时间到会锁定屏幕，需要家长密码才能继续；第二天自动重新计时。"
        onCancel={onCancel}
      >
        <div className="mt-5">
          <MinutesSlider value={minutes} onChange={setMinutes} />
        </div>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={finish}
            className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(74,128,240,0.9)] transition hover:brightness-110"
          >
            开启少儿守护
          </button>
          <button
            onClick={() => setStep('confirm')}
            className="rounded-xl px-4 py-2.5 text-[13.5px] text-muted/75 ring-1 ring-veil/10 transition hover:bg-veil/[0.06] hover:text-ink"
          >
            上一步
          </button>
        </div>
      </Shell>
    )
  }

  const first = step === 'pin'
  return (
    <Shell
      icon={<ShieldCheck size={20} strokeWidth={2} />}
      title={first ? '设置家长密码' : '再输一次'}
      desc={
        first
          ? '6 位数字。关闭软件、关闭守护、延长学习时间都要用它，请家长自己记好。'
          : '确认上一步输入的 6 位数字，两次要一样。'
      }
      onCancel={onCancel}
    >
      <div className="mt-5">
        <PinPad
          value={first ? pin : confirm}
          onChange={(v) => {
            setError(false)
            if (first) setPin(v)
            else setConfirm(v)
          }}
          onComplete={first ? submitPin : submitConfirm}
          onCancel={onCancel}
          error={error}
        />
      </div>
      <p
        className={clsx(
          'mt-3 h-4 text-center text-[11.5px] transition',
          error ? 'text-err' : 'text-muted/45',
        )}
      >
        {error ? '两次输入不一样，请重新确认' : first ? '输满 6 位自动进入下一步' : `第一次输入：${pin}`}
      </p>
    </Shell>
  )
}

/**
 * 验证家长密码。
 * 所有「孩子不该自己做」的动作都过这里：关软件、关守护、改时长、加时。
 */
export function PinAuthDialog({
  title,
  desc,
  tone = 'brand',
  confirmText,
  onCancel,
  onSuccess,
}: {
  title: string
  desc: string
  tone?: 'brand' | 'err'
  /** 通过后执行的按钮文案，留空则输满即通过 */
  confirmText?: string
  onCancel: () => void
  onSuccess: () => void
}) {
  const verifyPin = useApp((s) => s.verifyPin)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [fail, setFail] = useState(0)

  const check = (v: string) => {
    if (v.length !== 6) return
    if (confirmText) return
    if (verifyPin(v)) onSuccess()
    else {
      setError(true)
      setPin('')
      setFail((n) => n + 1)
    }
  }

  const manual = () => {
    if (pin.length !== 6) return
    if (verifyPin(pin)) onSuccess()
    else {
      setError(true)
      setPin('')
      setFail((n) => n + 1)
    }
  }

  return (
    <Shell
      icon={tone === 'err' ? <TriangleAlert size={20} strokeWidth={2} /> : <ShieldCheck size={20} strokeWidth={2} />}
      tone={tone}
      title={title}
      desc={desc}
      onCancel={onCancel}
    >
      <div className="mt-5">
        <PinPad
          value={pin}
          onChange={(v) => {
            setError(false)
            setPin(v)
          }}
          onComplete={check}
          onCancel={onCancel}
          error={error}
        />
      </div>
      <p
        className={clsx(
          'mt-3 h-4 text-center text-[11.5px] transition',
          error ? 'text-err' : 'text-muted/45',
        )}
      >
        {error ? `密码不对，再试一次（已错 ${fail} 次）` : '请输入家长设置的 6 位密码'}
      </p>
      {confirmText && (
        <button
          onClick={manual}
          disabled={pin.length !== 6}
          className="mt-3 w-full rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(74,128,240,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmText}
        </button>
      )}
    </Shell>
  )
}

/** 家长已验证后，用这个提示条告诉用户「刚才那一关过了」 */
export function GuardVerifiedHint({ minutes }: { minutes: number }) {
  return (
    <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-ok/70">
      家长已验证。当前每日上限 {fmtDuration(minutes * 60)}，关掉设置后需重新验证。
    </p>
  )
}
