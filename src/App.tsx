import { useEffect, useState } from 'react'
import { LogOut, ShieldCheck, X } from 'lucide-react'
import { useApp } from '@/store/useApp'
import BookShelf from '@/pages/BookShelf'
import Practice from '@/pages/Practice'
import Result from '@/pages/Result'
import WindowControls from '@/components/WindowControls'
import SettingsSheet from '@/components/SettingsSheet'
import GuardLock from '@/components/GuardLock'
import { PinAuthDialog } from '@/components/GuardDialogs'
import { BOOKS, DEFAULT_BOOK_ID } from '@/data/books'

const BOOK_KEY = 'spellpal:book'
/** 学习时长累计的节拍：10 秒记一次，足够准，也不会把 localStorage 写爆 */
const GUARD_TICK_MS = 10_000

/* 开发期调试接口：自动化截图脚本用它直接指定教材与单元 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__spellpalBooks = BOOKS
}

export default function App() {
  const phase = useApp((s) => s.phase)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const [bookId, setBookId] = useState<string>(() => {
    try {
      return localStorage.getItem(BOOK_KEY) || DEFAULT_BOOK_ID
    } catch {
      return DEFAULT_BOOK_ID
    }
  })
  const guardOn = useApp((s) => s.guardOn)
  const guardLocked = useApp((s) => s.guardLocked)
  const addGuardUsage = useApp((s) => s.addGuardUsage)
  const [quitOpen, setQuitOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(BOOK_KEY, bookId)
    } catch {
      /* ignore */
    }
  }, [bookId])

  /* 守护开关同步给主进程：决定启动/退出全屏，以及要不要拦 F11、Ctrl+R */
  useEffect(() => {
    window.spellpal?.setGuardMode?.(guardOn)
  }, [guardOn])

  /* 学时长计时：窗口最小化/切走时暂停，免得孩子一开软件就被计时 */
  useEffect(() => {
    if (!guardOn) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      addGuardUsage(GUARD_TICK_MS / 1000)
    }
    const id = window.setInterval(tick, GUARD_TICK_MS)
    return () => window.clearInterval(id)
  }, [guardOn, addGuardUsage])

  /* 关闭按钮、Alt+F4、任务栏关闭：主进程拦下来先问一句 */
  useEffect(() => {
    const api = window.spellpal
    if (!api?.onAskClose) return
    return api.onAskClose(() => setQuitOpen(true))
  }, [])

  return (
    <div className="relative h-full">
      {phase === 'idle' && (
        <BookShelf
          books={BOOKS}
          bookId={bookId}
          onPickBook={setBookId}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {phase === 'typing' && <Practice onOpenSettings={() => setSettingsOpen(true)} />}
      {phase === 'done' && <Result />}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      {guardOn && guardLocked && <GuardLock />}

      {quitOpen && <QuitConfirm onCancel={() => setQuitOpen(false)} />}

      {/* 放最后渲染：拖拽区按 DOM 顺序登记，晚上一步的 no-drag 才压得住顶栏 */}
      <WindowControls />
    </div>
  )
}

/**
 * 退出前的二次确认。
 *
 * 练习途中误点 X 会丢掉这一轮，所以默认动作是「继续练」：
 * Esc / Enter / 空格都当取消，点背景也是取消。
 * 弹框期间在捕获阶段把按键截掉，否则底下的练习页照吃字母（它挂在 window 冒泡上）。
 */
function QuitConfirm({ onCancel }: { onCancel: () => void }) {
  const phase = useApp((s) => s.phase)
  const guardOn = useApp((s) => s.guardOn)
  const inPractice = phase === 'typing'
  /** 开了少儿守护：点「退出软件」先过家长密码 */
  const [needPin, setNeedPin] = useState(false)

  useEffect(() => {
    /* 密码框自己有按键处理，这里让位 */
    if (needPin) return
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      e.preventDefault()
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel, needPin])

  const quit = () => {
    if (guardOn) {
      setNeedPin(true)
      return
    }
    window.spellpal?.closeConfirmed()
  }

  return (
    <div
      data-quit-modal
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-stage/70 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="relative w-[404px] overflow-hidden rounded-3xl bg-panel p-6 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.7)] ring-1 ring-veil/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-brand/20 blur-2xl" />
        <button
          onClick={onCancel}
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted/60 transition hover:bg-veil/[0.07] hover:text-ink"
          title="继续练习"
        >
          <X size={15} strokeWidth={2.2} />
        </button>

        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-err/15 text-err">
            <LogOut size={21} strokeWidth={2.1} />
          </div>
          <h2 className="mt-4 text-[19px] font-bold">要关掉小拼手吗？</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted/75">
            {guardOn && '少儿守护开着，退出前要输入家长密码。'}
            {guardOn && <br />}
            {inPractice
              ? '这一轮还没练完，现在退出不会记录这次的进度，下次可以接着从这一单元练。'
              : '拼好的单词和错题本都已经存好了，关掉不会丢，下次打开还在。'}
          </p>

          <div className="mt-6 flex gap-2.5">
            <button
              autoFocus
              onClick={onCancel}
              className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(124,92,255,0.9)] transition hover:brightness-110"
            >
              继续练
            </button>
            <button
              onClick={quit}
              className="rounded-xl px-4 py-2.5 text-[14px] font-medium text-muted/80 ring-1 ring-veil/10 transition hover:bg-err/10 hover:text-err hover:ring-err/30"
            >
              退出软件
            </button>
          </div>
        </div>
      </div>

      {needPin && (
        <PinAuthDialog
          tone="err"
          title="退出需要家长密码"
          desc="少儿守护开着的时候，关闭软件要家长验证一次。"
          confirmText="验证并退出"
          onCancel={() => setNeedPin(false)}
          onSuccess={() => window.spellpal?.closeConfirmed()}
        />
      )}
    </div>
  )
}
