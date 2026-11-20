import { useEffect, useState } from 'react'
import { Moon, ShieldCheck } from 'lucide-react'
import { GUARD_EXTEND_MINUTES, useApp } from '@/store/useApp'
import { PinAuthDialog } from '@/components/GuardDialogs'
import { fmtDuration } from '@/core/pin'

/**
 * 今日学习时长用完后的全屏锁定。
 *
 * 孩子自己是过不去这一屏的：唯一的出口是家长密码，密码对了才 +10 分钟。
 * 关软件也一样要密码（QuitConfirm 那关）。
 * 这里同样在捕获阶段截按键，否则底下的练习页还在吃字母。
 */
export default function GuardLock() {
  const used = useApp((s) => s.guardUsedSec)
  const minutes = useApp((s) => s.guardMinutes)
  const bonus = useApp((s) => s.guardBonusSec)
  const extendGuard = useApp((s) => s.extendGuard)
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* 弹密码框时交给 PinPad 处理 */
      if (ask) return
      e.stopImmediatePropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ask])

  const limit = minutes * 60 + bonus

  return (
    <div
      data-guard-lock
      className="fixed inset-0 z-[900] flex items-center justify-center bg-stage/[0.94] backdrop-blur-md"
    >
      <div className="w-[560px] rounded-[28px] bg-panel p-10 text-center shadow-[0_30px_90px_-24px_rgba(0,0,0,0.8)] ring-1 ring-veil/10">
        <div className="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-brand/15 text-brand">
          <Moon size={40} strokeWidth={1.7} />
        </div>
        <h1 className="mt-5 text-[30px] font-bold">今天的学习时间到啦</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted/70">
          已经学了 {fmtDuration(used)}，今天约定的是 {fmtDuration(limit)}。
          <br />
          休息一下眼睛，明天再来拼单词吧。
        </p>

        <div className="mt-6 rounded-2xl bg-veil/[0.03] px-4 py-3.5 ring-1 ring-veil/[0.06]">
          <div className="flex items-center justify-between text-[12.5px] text-muted/60">
            <span>今日进度</span>
            <span className="tabnum">
              {Math.floor(used / 60)} / {Math.floor(limit / 60)} 分钟
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-veil/[0.08]">
            <div className="h-full rounded-full bg-brand" style={{ width: '100%' }} />
          </div>
        </div>

        <button
          onClick={() => setAsk(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-4 text-[16.5px] font-semibold text-white shadow-[0_10px_26px_-10px_rgba(124,92,255,0.95)] transition hover:brightness-110"
        >
          <ShieldCheck size={18} strokeWidth={2.2} />
          家长解锁，再学 {GUARD_EXTEND_MINUTES} 分钟
        </button>
        <p className="mt-3.5 text-[11.5px] leading-relaxed text-muted/40">
          需要家长密码。每日时长可以在「设置 → 少儿守护」里调整。
        </p>
      </div>

      {ask && (
        <PinAuthDialog
          title="家长解锁"
          desc={`输入家长密码，今天的额度增加 ${GUARD_EXTEND_MINUTES} 分钟。`}
          onCancel={() => setAsk(false)}
          onSuccess={() => {
            extendGuard(GUARD_EXTEND_MINUTES)
            setAsk(false)
          }}
        />
      )}
    </div>
  )
}
