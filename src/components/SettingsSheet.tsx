import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowUpRight,
  Check,
  Clock,
  CornerDownLeft,
  Heart,
  Keyboard,
  Lock,
  Moon,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Volume1,
  Volume2,
  X,
} from 'lucide-react'
import {
  FONT_MAX,
  FONT_MIN,
  GUARD_MAX_MINUTES,
  GUARD_MIN_MINUTES,
  VOLUME_DEFAULT,
  useApp,
} from '@/store/useApp'
import type { Theme } from '@/store/useApp'
import { fmtDuration } from '@/core/pin'
import { PinAuthDialog, PinSetupDialog } from '@/components/GuardDialogs'
import { noticeLines, openRepo, repoUrl } from '@/core/notice'
import { ERROR_SFX, KEY_SFX, SUCCESS_SFX, playError, playKey, playSuccess } from '@/utils/sound'

/** 一行设置：左边标题+说明，右边控件 */
function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-veil/[0.03] px-3.5 py-2 ring-1 ring-veil/[0.06]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-veil/[0.05] text-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink/90">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted/60">{desc}</span>
      </span>
      {children}
    </div>
  )
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx(
        'relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors duration-200',
        on ? 'bg-brand' : 'bg-veil/[0.14]',
      )}
    >
      <span
        className={clsx(
          'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-200',
          on ? 'left-[21px]' : 'left-[3px]',
        )}
      />
    </button>
  )
}

/** 音效选择：8 个数字 + 试听，按键音那行多一个开关 */
function SoundRow({
  kind,
  icon,
  title,
  value,
  onChange,
  toggle,
}: {
  kind: 'ok' | 'err' | 'key'
  icon: React.ReactNode
  title: string
  value: number
  onChange: (i: number) => void
  /** 只有按键音用得上：关掉后不发声，但点数字会自动打开 */
  toggle?: { on: boolean; onChange: (v: boolean) => void }
}) {
  const presets = kind === 'ok' ? SUCCESS_SFX : kind === 'err' ? ERROR_SFX : KEY_SFX
  const preview = () => {
    if (kind === 'ok') playSuccess(value)
    else if (kind === 'err') playError(value)
    else playKey(value)
  }
  const off = toggle ? !toggle.on : false

  return (
    <div className="flex items-center gap-2 rounded-xl bg-veil/[0.03] px-2.5 py-1.5 ring-1 ring-veil/[0.06]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-veil/[0.05] text-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-ink/90">{title}</span>
        <span className="mt-0.5 block truncate text-[10px] text-muted/55">
          {off ? '已关闭' : `当前：${presets[value]?.name ?? '—'}`}
        </span>
      </span>
      <div className={clsx('flex shrink-0 items-center gap-[3px] transition', off && 'opacity-40')}>
        {presets.map((pr, i) => (
          <button
            key={i}
            onClick={() => {
              onChange(i)
              if (off) toggle?.onChange(true)
            }}
            title={pr.name}
            className={clsx(
              'tabnum h-[21px] w-[21px] rounded-md text-[10px] leading-none transition',
              i === value && !off
                ? 'bg-brand text-white shadow-[0_2px_10px_rgba(124,92,255,0.45)]'
                : 'bg-veil/[0.05] text-muted/60 hover:bg-veil/[0.1] hover:text-ink',
            )}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={preview}
          title="试听"
          className="ml-1 flex h-[21px] w-[21px] items-center justify-center rounded-md bg-veil/[0.05] text-muted transition hover:bg-brand/15 hover:text-brand"
        >
          <Play size={10} strokeWidth={2.2} fill="currentColor" />
        </button>
      </div>
      {toggle && (
        <button
          onClick={() => toggle.onChange(!toggle.on)}
          title={toggle.on ? '关闭按键音' : '开启按键音'}
          className={clsx(
            'ml-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition',
            toggle.on ? 'justify-end bg-brand' : 'justify-start bg-veil/[0.12]',
          )}
        >
          <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
        </button>
      )}
    </div>
  )
}

export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const kbOn = useApp((s) => s.kbOn)
  const setKbOn = useApp((s) => s.setKbOn)
  const enterSkip = useApp((s) => s.enterSkip)
  const setEnterSkip = useApp((s) => s.setEnterSkip)
  const sfxOk = useApp((s) => s.sfxOk)
  const sfxErr = useApp((s) => s.sfxErr)
  const sfxKey = useApp((s) => s.sfxKey)
  const keySfxOn = useApp((s) => s.keySfxOn)
  const setKeySfxOn = useApp((s) => s.setKeySfxOn)
  const setSfx = useApp((s) => s.setSfx)
  const volume = useApp((s) => s.volume)
  const setVolume = useApp((s) => s.setVolume)
  const fontScale = useApp((s) => s.fontScale)
  const setFontScale = useApp((s) => s.setFontScale)

  const guardOn = useApp((s) => s.guardOn)
  const guardMinutes = useApp((s) => s.guardMinutes)
  const guardUsedSec = useApp((s) => s.guardUsedSec)
  const guardBonusSec = useApp((s) => s.guardBonusSec)
  const disableGuard = useApp((s) => s.disableGuard)
  const setGuardMinutes = useApp((s) => s.setGuardMinutes)

  const [tab, setTab] = useState<'general' | 'sound' | 'guard' | 'about'>('general')
  /** 首次开启：设密码 + 定时长 */
  const [setupOpen, setSetupOpen] = useState(false)
  /** 家长已验密码：本次设置面板内才允许改时长、关守护 */
  const [guardOk, setGuardOk] = useState(false)
  const [auth, setAuth] = useState<null | 'disable' | 'edit'>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const themes: { key: Theme; label: string; icon: React.ReactNode; hint: string }[] = [
    { key: 'dark', label: '深色', icon: <Moon size={14} strokeWidth={2} />, hint: '夜间、关灯后' },
    { key: 'light', label: '浅色', icon: <Sun size={14} strokeWidth={2} />, hint: '白天、光线足' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-veil/10">
        <header
          className="flex h-14 shrink-0 items-center gap-3 border-b border-veil/[0.07] px-5"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-[14px] font-semibold">设置</span>
          <span className="hidden text-[11px] text-muted/45 sm:inline">改完立即生效，自动保存</span>

          {/* 标签页 */}
          <div className="no-drag ml-auto flex items-center gap-0.5 rounded-lg bg-veil/[0.05] p-0.5">
            {(
              [
                ['general', '常规'],
                ['sound', '声音'],
                ['guard', '守护'],
                ['about', '关于'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-[11.5px] transition',
                  tab === k ? 'bg-card text-ink shadow-sm' : 'text-muted/60 hover:text-ink/80',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="no-drag ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-veil/[0.07] hover:text-ink"
            title="关闭（Esc）"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        {tab !== 'about' ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
            {/* 主题 */}
            <section className={tab !== 'general' ? 'hidden' : undefined}>
              <div className="mb-2 text-[11px] font-medium tracking-wide text-muted/55">外观</div>
              <div className="grid grid-cols-2 gap-2.5">
                {themes.map((t) => {
                  const on = theme === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTheme(t.key)}
                      className={clsx(
                        'group relative overflow-hidden rounded-xl px-3.5 py-2 text-left ring-1 transition',
                        on
                          ? 'bg-brand/10 ring-brand/55'
                          : 'bg-veil/[0.03] ring-veil/[0.07] hover:ring-veil/20',
                      )}
                    >
                      <div
                        className="mb-1.5 flex h-8 items-center gap-1.5 rounded-lg px-2.5"
                        style={{ background: t.key === 'dark' ? '#0B0E13' : '#F5F7FB' }}
                      >
                        <span
                          className="h-5 w-5 rounded-md"
                          style={{ background: t.key === 'dark' ? '#161C26' : '#FFFFFF' }}
                        />
                        <span className="flex-1">
                          <span
                            className="block h-[5px] w-8 rounded-full"
                            style={{ background: '#7C5CFF' }}
                          />
                          <span
                            className="mt-1 block h-[4px] w-12 rounded-full"
                            style={{ background: t.key === 'dark' ? '#2A3342' : '#D7DDE8' }}
                          />
                        </span>
                        <span
                          className="h-5 w-5 rounded-full"
                          style={{ background: t.key === 'dark' ? '#1F2733' : '#E7EBF3' }}
                        />
                      </div>
                      <span className="flex items-center gap-1.5 text-[13px] font-medium">
                        {t.icon}
                        {t.label}
                        {on && <Check size={13} strokeWidth={3} className="ml-auto text-brand" />}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-muted/55">{t.hint}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 字号 */}
            <section className={tab !== 'general' ? 'hidden' : undefined}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted/55">
                  练习页字号
                </span>
                <span className="tabnum text-[11px] text-brand/90">
                  {Math.round(fontScale * 100)}%
                </span>
              </div>
              <div className="rounded-xl bg-veil/[0.03] px-3.5 py-2 ring-1 ring-veil/[0.06]">
                <input
                  type="range"
                  min={FONT_MIN * 100}
                  max={FONT_MAX * 100}
                  step={5}
                  value={Math.round(fontScale * 100)}
                  onChange={(e) => setFontScale(Number(e.target.value) / 100)}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-veil/[0.12] accent-[rgb(var(--brand))]"
                />
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted/45">
                  <span>{Math.round(FONT_MIN * 100)}%</span>
                  <button
                    onClick={() => setFontScale(1.15)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-muted/60 transition hover:bg-veil/[0.06] hover:text-ink"
                  >
                    <RotateCcw size={10} strokeWidth={2.4} />
                    恢复 115%
                  </button>
                  <span>{Math.round(FONT_MAX * 100)}%</span>
                </div>
              </div>
              <p className="mt-1 px-1 text-[10px] leading-relaxed text-muted/40">
                长句子放不下时，字号会自动降到屏幕能容下的最大值。
              </p>
            </section>

            {/* 音量 */}
            <section className={tab !== 'sound' ? 'hidden' : undefined}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted/55">音量</span>
                <span className="tabnum text-[11px] text-brand/90">
                  {volume === 0 ? '静音' : `${volume}%`}
                </span>
              </div>
              <div className="rounded-xl bg-veil/[0.03] px-3.5 py-2 ring-1 ring-veil/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Volume1 size={14} strokeWidth={2} className="shrink-0 text-muted/50" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-veil/[0.12] accent-[rgb(var(--brand))]"
                    title="调音量，松手就记住"
                  />
                  <Volume2 size={14} strokeWidth={2} className="shrink-0 text-muted/50" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted/45">
                  <span>静音</span>
                  <button
                    onClick={() => setVolume(VOLUME_DEFAULT)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-muted/60 transition hover:bg-veil/[0.06] hover:text-ink"
                  >
                    <RotateCcw size={10} strokeWidth={2.4} />
                    恢复默认
                  </button>
                  <span>100%</span>
                </div>
              </div>
              <p className="mt-1 px-1 text-[10px] leading-relaxed text-muted/40">
                「听英文」的朗读和音效一起调。想单独关掉滴滴声，去下面关按键音。
              </p>
            </section>

            {/* 练习辅助 */}
            <section className={tab !== 'general' ? 'hidden' : undefined}>
              <div className="mb-2 text-[11px] font-medium tracking-wide text-muted/55">
                练习辅助
              </div>
              <div className="space-y-2">
                <Row
                  icon={<Keyboard size={15} strokeWidth={1.9} />}
                  title="显示虚拟键盘"
                  desc="底部显示键盘和手指提示，练习页右上角也能开关"
                >
                  <Switch on={kbOn} onChange={setKbOn} label="显示虚拟键盘" />
                </Row>

                <Row
                  icon={<CornerDownLeft size={15} strokeWidth={1.9} />}
                  title="回车键跳过整句"
                  desc="默认关闭。开启后回车跳到下一句，进错题本"
                >
                  <Switch
                    on={enterSkip}
                    onChange={(v) => setEnterSkip(v)}
                    label="回车键跳过整句"
                  />
                </Row>
              </div>
              <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-muted/40">
                空格固定是「拼完进下一句」；回车跳过默认关着，单词没打完不能跳。
              </p>
            </section>

            {/* 少儿守护 */}
            <section className={tab !== 'guard' ? 'hidden' : undefined}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted/55">
                  少儿守护
                </span>
                <span className="text-[10px] text-muted/40">家长密码 6 位数字</span>
              </div>

              <Row
                icon={<ShieldCheck size={15} strokeWidth={1.9} />}
                title={guardOn ? '少儿守护已开启' : '开启少儿守护'}
                desc={
                  guardOn
                    ? '启动即全屏；关软件、关守护、加时都要密码'
                    : '限定每天的学习时长，到点锁定屏幕'
                }
              >
                <Switch
                  on={guardOn}
                  onChange={(v) => {
                    if (v && !guardOn) {
                      setSetupOpen(true)
                      return
                    }
                    if (!v && guardOn) {
                      if (guardOk) disableGuard()
                      else setAuth('disable')
                    }
                  }}
                  label="少儿守护"
                />
              </Row>

              {guardOn && (
                <>
                  {/* 今日进度 */}
                  <div className="mt-2 rounded-xl bg-veil/[0.03] px-3.5 py-2.5 ring-1 ring-veil/[0.06]">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-medium text-ink/85">
                        今天已学 {fmtDuration(guardUsedSec)}
                      </span>
                      <span className="tabnum text-[11px] text-muted/55">
                        额度 {fmtDuration(guardMinutes * 60 + guardBonusSec)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-veil/[0.08]">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (guardUsedSec / Math.max(1, guardMinutes * 60 + guardBonusSec)) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-muted/45">
                      {guardBonusSec > 0 && `其中家长加时 ${fmtDuration(guardBonusSec)}；`}
                      每天 0 点自动重新计时。
                    </p>
                  </div>

                  {/* 每日时长：没验密码前锁着 */}
                  <div className="mt-2">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted/55">
                        <Clock size={11} strokeWidth={2.2} />
                        每天学习时长
                      </span>
                      {guardOk && (
                        <span className="tabnum text-[11px] text-brand/90">{guardMinutes} 分钟</span>
                      )}
                    </div>

                    {guardOk ? (
                      <div className="rounded-xl bg-veil/[0.03] px-3.5 py-2.5 ring-1 ring-veil/[0.06]">
                        <input
                          type="range"
                          min={GUARD_MIN_MINUTES}
                          max={GUARD_MAX_MINUTES}
                          step={5}
                          value={guardMinutes}
                          onChange={(e) => setGuardMinutes(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-veil/[0.12] accent-[rgb(var(--brand))]"
                        />
                        <div className="mt-2 flex justify-between text-[10.5px] text-muted/45">
                          <span>{GUARD_MIN_MINUTES} 分钟</span>
                          <span>{GUARD_MAX_MINUTES} 分钟</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAuth('edit')}
                        className="flex w-full items-center gap-2 rounded-xl bg-veil/[0.03] px-3.5 py-2.5 text-left ring-1 ring-veil/[0.06] transition hover:bg-brand/10 hover:ring-brand/35"
                      >
                        <Lock size={13} strokeWidth={2} className="shrink-0 text-muted/50" />
                        <span className="text-[11.5px] text-muted/65">
                          已设为 {guardMinutes} 分钟，点这里验证家长密码后修改
                        </span>
                      </button>
                    )}
                  </div>

                  <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted/40">
                    时长到了会锁定整个界面，只有家长密码能再加 10 分钟。
                    {guardOk && ' 本次已验证，关掉设置后自动上锁。'}
                  </p>
                </>
              )}

              {!guardOn && (
                <>
                  <div className="mt-2.5 space-y-2 rounded-xl bg-veil/[0.02] px-3.5 py-3 ring-1 ring-veil/[0.05]">
                    {[
                      ['全屏专注', '打开软件自动铺满屏幕，刷新和开发者工具也一并锁住'],
                      ['到点锁屏', '学满约定时长后整屏锁定，只有家长密码能再加 10 分钟'],
                      ['退出要密码', '关闭按钮、Alt+F4、任务栏关闭都会先要密码'],
                    ].map(([t, d]) => (
                      <div key={t} className="flex gap-2.5">
                        <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                        <p className="text-[11px] leading-relaxed text-muted/60">
                          <span className="font-medium text-ink/80">{t}</span>
                          <span className="mx-1.5 text-muted/30">·</span>
                          {d}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-muted/40">
                    第一次开启要设一个 6 位数字密码并定好每天能学多久。密码只保存在本机，
                    忘记后按「关于」页的说明清数据重设。
                  </p>
                </>
              )}
            </section>

            {/* 音效 */}
            <section className={tab !== 'sound' ? 'hidden' : undefined}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-medium tracking-wide text-muted/55">音效</span>
                <span className="text-[10px] text-muted/40">各 8 种，点数字换音色</span>
              </div>
              <div className="space-y-2">
                <SoundRow
                  kind="ok"
                  icon={<Sparkles size={14} strokeWidth={2} />}
                  title="拼对整句"
                  value={sfxOk}
                  onChange={(i) => setSfx('ok', i)}
                />
                <SoundRow
                  kind="err"
                  icon={<X size={14} strokeWidth={2.4} />}
                  title="拼错字母"
                  value={sfxErr}
                  onChange={(i) => setSfx('err', i)}
                />
                <SoundRow
                  kind="key"
                  icon={<Keyboard size={14} strokeWidth={2} />}
                  title="按键音"
                  value={sfxKey}
                  onChange={(i) => setSfx('key', i)}
                  toggle={{ on: keySfxOn, onChange: setKeySfxOn }}
                />
              </div>
            </section>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="rounded-xl bg-veil/[0.03] px-4 py-3.5 ring-1 ring-veil/[0.06]">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <Heart size={14} strokeWidth={2.2} className="text-err/80" />
                小拼手 SpellPal
                <span className="tabnum rounded-md bg-veil/[0.06] px-1.5 py-[1px] text-[10px] font-normal text-muted/70">
                  v{__APP_VERSION__}
                </span>
              </div>
              <div className="mt-2.5 space-y-2">
                {noticeLines().map((line, i) => (
                  <p
                    key={i}
                    className={clsx(
                      'text-[11.5px] leading-relaxed',
                      i === 0 ? 'font-medium text-ink/85' : 'text-muted/60',
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
              <button
                onClick={openRepo}
                className="mt-3 flex w-full items-center gap-2 rounded-lg bg-veil/[0.04] px-3 py-2 text-left text-[11.5px] text-muted/75 ring-1 ring-veil/[0.07] transition hover:bg-brand/10 hover:text-brand hover:ring-brand/40"
                title="在浏览器中打开"
              >
                <span className="truncate font-mono">{repoUrl().replace(/^https:\/\//, '')}</span>
                <ArrowUpRight size={13} strokeWidth={2.4} className="ml-auto shrink-0" />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-veil/[0.02] px-4 py-3 text-[10.5px] leading-relaxed text-muted/45 ring-1 ring-veil/[0.05]">
              <p>词表来自人民教育出版社《义务教育教科书·英语（PEP）》各册附录，仅用于家庭学习。</p>
              <p className="mt-1.5">
                例句为本项目自编，不是课文原文；音频由系统语音合成，未使用出版社录音。
              </p>
              <p className="mt-1.5">本项目与人民教育出版社无任何关联，是非官方的个人学习工具。</p>
              <p className="mt-1.5">
                忘记家长密码：完全退出软件后，删除
                <span className="mx-1 font-mono text-muted/60">%APPDATA%\SpellPal\Local Storage</span>
                文件夹再启动，守护设置与练习记录会一起重置。
              </p>
            </div>
          </div>
        )}
      </div>

      {setupOpen && (
        <PinSetupDialog
          onCancel={() => setSetupOpen(false)}
          onDone={() => {
            setSetupOpen(false)
            setGuardOk(true)
          }}
        />
      )}

      {auth === 'disable' && (
        <PinAuthDialog
          tone="err"
          title="关闭少儿守护"
          desc="关掉后不再全屏，退出软件也不再需要密码。确认是家长本人操作。"
          confirmText="验证并关闭"
          onCancel={() => setAuth(null)}
          onSuccess={() => {
            disableGuard()
            setGuardOk(false)
            setAuth(null)
          }}
        />
      )}

      {auth === 'edit' && (
        <PinAuthDialog
          title="家长验证"
          desc="验证通过后可以调整每天的学习时长。"
          confirmText="验证"
          onCancel={() => setAuth(null)}
          onSuccess={() => {
            setGuardOk(true)
            setAuth(null)
          }}
        />
      )}
    </div>
  )
}
