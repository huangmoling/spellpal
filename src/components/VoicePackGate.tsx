import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Download, FolderOpen, RefreshCw, Volume2, WifiOff } from 'lucide-react'
import type { VoicePackProgress, VoicePackStatus } from '@/env'

/**
 * 首次启动的语音包引导页。
 *
 * 安装包里不再带 134 MB 的 mp3，第一次打开需要联网下载一次；
 * 装好之后就在 userData 里躺着，以后启动不再问。
 *
 * 三种出口：
 *   - 正常下载（自动开始，可取消）
 *   - 从本地文件导入（学校机房 / 内网 / 下载源全挂时的兜底）
 *   - 先跳过（退回系统语音，声音差一点但能练）
 */

const PHASE_TEXT: Record<string, string> = {
  start: '正在连接下载服务器…',
  download: '正在下载语音包…',
  verify: '正在校验文件完整性…',
  extract: '正在解压音频…',
  install: '正在安装…',
  switch: '当前下载源不通，正在切换…',
}

function human(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

function etaText(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return ''
  if (sec < 60) return `还剩 ${Math.round(sec)} 秒`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `还剩 ${m} 分 ${s} 秒`
}

export default function VoicePackGate({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<VoicePackStatus | null>(null)
  const [phase, setPhase] = useState<'checking' | 'idle' | 'busy' | 'error'>('checking')
  const [p, setP] = useState<VoicePackProgress>({ phase: 'start' })
  const [err, setErr] = useState('')
  const [started, setStarted] = useState(false)
  const doneRef = useRef(false)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onReady()
  }, [onReady])

  /* 挂载时问一次主进程：已经能发音就直接放行，不要打扰用户 */
  useEffect(() => {
    let alive = true
    const api = window.spellpal?.voicePack
    if (!api) {
      /* 浏览器里跑（vite dev / 截图）没有主进程，当成已就绪 */
      finish()
      return
    }
    api
      .status()
      .then((s) => {
        if (!alive) return
        setStatus(s)
        if (s.usable || s.expectedCount === 0) finish()
        else setPhase('idle')
      })
      .catch(() => {
        if (alive) finish()
      })
    return () => {
      alive = false
    }
  }, [finish])

  /* 订阅主进程的进度事件 */
  useEffect(() => {
    const api = window.spellpal?.voicePack
    if (!api) return
    return api.onProgress((next) => {
      setP(next)
      if (next.phase === 'done') finish()
      if (next.phase === 'error') {
        setErr(next.message || '下载失败')
        setPhase('error')
      }
    })
  }, [finish])

  /** 进度事件里如果只拿到 start（还没开始报字节），也要把界面切到 busy */
  const start = async () => {
    const api = window.spellpal?.voicePack
    if (!api) return
    setPhase('busy')
    setErr('')
    setStarted(true)
    setP({ phase: 'start' })
    const r = await api.download()
    if (!r.ok && !doneRef.current) {
      setErr(r.message || '下载失败')
      setPhase('error')
    }
  }

  const importFile = async () => {
    const api = window.spellpal?.voicePack
    if (!api) return
    setPhase('busy')
    setErr('')
    setStarted(true)
    const r = await api.pickAndInstall()
    if (r.canceled) {
      setPhase(status?.installed ? 'idle' : 'idle')
      return
    }
    if (!r.ok && !doneRef.current) {
      setErr(r.message || '导入失败')
      setPhase('error')
    } else if (r.ok) {
      finish()
    }
  }

  const skip = async () => {
    await window.spellpal?.voicePack?.skip(true)
    finish()
  }

  if (phase === 'checking') {
    return <div className="h-full w-full bg-stage" />
  }

  const total = p.total || status?.bytes || 0
  const got = p.got || 0
  const pct = total > 0 ? Math.min(100, (got / total) * 100) : 0
  const busy = phase === 'busy'

  return (
    <div
      data-voicepack-gate
      className="fixed inset-0 z-[950] flex items-center justify-center bg-stage"
    >
      <div className="w-[580px] rounded-[28px] bg-card p-9 shadow-[0_24px_70px_-26px_rgba(61,53,82,0.28)] ring-1 ring-veil/[0.06]">
        {/* 图标：下载中显示下载，出错显示断网，其余显示喇叭 */}
        <div
          className={`mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-full ${
            phase === 'error' ? 'bg-err/12 text-err' : busy ? 'bg-brand/12 text-brand' : 'bg-brand/15 text-brand'
          }`}
        >
          {phase === 'error' ? (
            <WifiOff size={38} strokeWidth={1.7} />
          ) : p.phase === 'done' ? (
            <Check size={40} strokeWidth={2} />
          ) : busy ? (
            <Download size={36} strokeWidth={1.8} />
          ) : (
            <Volume2 size={38} strokeWidth={1.8} />
          )}
        </div>

        <h1 className="mt-5 text-center text-[27px] font-bold">
          {phase === 'error' ? '语音包没下成功' : busy ? '正在准备发音' : '小拼手要下载发音啦'}
        </h1>

        <p className="mx-auto mt-3 max-w-[440px] text-center text-[13.5px] leading-relaxed text-muted/70">
          {phase === 'error' ? (
            err
          ) : busy ? (
            PHASE_TEXT[p.phase] || '处理中…'
          ) : (
            <>
              单词和例句的高清发音需要单独下载一次，大约{' '}
              <span className="font-semibold text-ink/85">{human(status?.bytes || 0)}</span>
              ，共 {(status?.expectedCount || 0).toLocaleString()} 段。
              <br />
              下载一次就永久存在本机，以后打开不用再联网。
            </>
          )}
        </p>

        {/* 进度区 */}
        {(busy || phase === 'error') && (
          <div className="mt-6 rounded-2xl bg-veil/[0.035] px-4 py-3.5 ring-1 ring-veil/[0.06]">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-muted/60">
                {p.partCount ? `第 ${p.partIndex} / ${p.partCount} 卷` : '准备中'}
              </span>
              <span className="tabnum text-[15px] font-semibold text-ink/85">{pct.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-veil/[0.08]">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  phase === 'error' ? 'bg-err/70' : 'bg-brand'
                }`}
                style={{ width: `${phase === 'error' ? 100 : pct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted/50">
              <span className="tabnum">
                {p.phase === 'extract'
                  ? `${got} / ${total} 段`
                  : `${human(got)} / ${human(total)}`}
              </span>
              <span className="tabnum">
                {phase === 'error'
                  ? '已保留下载进度，重试会接着下'
                  : p.speed
                    ? `${human(p.speed)}/s · ${etaText(p.eta || 0)}`
                    : ''}
              </span>
            </div>
          </div>
        )}

        {/* 动作区 */}
        <div className="mt-6 space-y-2.5">
          {phase === 'error' ? (
            <button
              onClick={start}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15.5px] font-semibold text-white shadow-[0_10px_26px_-10px_rgba(74,128,240,0.95)] transition hover:brightness-110"
            >
              <RefreshCw size={17} strokeWidth={2.2} />
              重试下载
            </button>
          ) : (
            <button
              onClick={start}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15.5px] font-semibold text-white shadow-[0_10px_26px_-10px_rgba(74,128,240,0.95)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <RefreshCw size={17} strokeWidth={2.2} className="animate-spin" />
                  正在下载，请稍等
                </>
              ) : (
                <>
                  <Download size={17} strokeWidth={2.2} />
                  开始下载（{human(status?.bytes || 0)}）
                </>
              )}
            </button>
          )}

          <div className="flex gap-2.5">
            <button
              onClick={importFile}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-muted/75 ring-1 ring-veil/10 transition hover:bg-veil/[0.05] hover:text-ink disabled:opacity-40"
            >
              <FolderOpen size={15} strokeWidth={2} />
              从文件导入
            </button>
            <button
              onClick={skip}
              disabled={busy}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-medium text-muted/60 transition hover:bg-veil/[0.05] hover:text-muted/85 disabled:opacity-40"
            >
              {started ? '先不下了' : '先用系统语音'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted/40">
          跳过也能用，只是发音会走系统自带的语音引擎，音色生硬一些。
          <br />
          想补下载的时候，在「设置 → 声音」里随时可以重新下载。
        </p>
      </div>
    </div>
  )
}
