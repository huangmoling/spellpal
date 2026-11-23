import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FolderOpen, RefreshCw, Trash2, Volume2 } from 'lucide-react'
import type { VoicePackProgress, VoicePackStatus } from '@/env'

/**
 * 设置里的「离线语音包」一行 + 展开面板。
 *
 * 首启引导页只是让用户「装上」，这里负责后续所有维护：
 * 补下载（当时跳过了）、更新（换音色后版本号变了）、删除、从文件导入。
 */

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

export default function VoicePackSetting() {
  const [st, setSt] = useState<VoicePackStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [p, setP] = useState<VoicePackProgress>({ phase: 'start' })
  const [msg, setMsg] = useState('')

  const refresh = () => {
    window.spellpal?.voicePack
      ?.status()
      .then(setSt)
      .catch(() => setSt(null))
  }

  useEffect(() => {
    refresh()
    return window.spellpal?.voicePack?.onProgress((next) => {
      setP(next)
      if (next.phase === 'done') {
        setBusy(false)
        setMsg(`已安装 ${next.count || 0} 段音频`)
        refresh()
      }
      if (next.phase === 'error') {
        setBusy(false)
        setMsg(next.message || '操作失败')
        refresh()
      }
    })
  }, [])

  const api = window.spellpal?.voicePack
  if (!api) return null

  const run = async (fn: () => Promise<{ ok: boolean; message?: string; canceled?: boolean }>) => {
    setBusy(true)
    setMsg('')
    const r = await fn()
    if (!r.ok && !r.canceled) setMsg(r.message || '操作失败')
    setBusy(false)
    refresh()
  }

  const installed = Boolean(st?.installed)
  const count = st?.count || 0
  const bundled = st?.bundled || 0
  const total = p.total || st?.bytes || 0
  const got = p.got || 0
  const pct = total > 0 ? Math.min(100, (got / total) * 100) : 0

  const desc = busy
    ? '正在下载，请保持联网…'
    : installed
      ? `已安装 ${count.toLocaleString()} 段${st?.outdated ? '（有新版本可更新）' : ''}`
      : bundled > 0
        ? `未安装，暂用安装包自带的 ${bundled} 段`
        : st?.skipped
          ? '未安装，正在用系统语音，随时可以补下'
          : '还没下载'

  return (
    <div className="mt-2 rounded-xl bg-veil/[0.03] px-3.5 py-2.5 ring-1 ring-veil/[0.06]">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-veil/[0.05] text-muted">
          {installed ? (
            <CheckCircle2 size={15} strokeWidth={1.9} className="text-ok" />
          ) : (
            <Volume2 size={15} strokeWidth={1.9} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink/90">离线语音包</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted/60">{desc}</span>
        </span>
        <button
          onClick={() => run(() => api.download())}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-brand/12 px-2.5 py-1.5 text-[11.5px] font-medium text-brand transition hover:bg-brand/20 disabled:opacity-50"
        >
          {busy ? (
            <RefreshCw size={12} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Download size={12} strokeWidth={2.4} />
          )}
          {installed ? '重新下载' : '下载'}
        </button>
      </div>

      {busy && (
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-veil/[0.08]">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-muted/45">
            <span className="tabnum">
              {p.phase === 'extract' ? `${got} / ${total} 段` : `${human(got)} / ${human(total)}`}
            </span>
            <span className="tabnum">{pct.toFixed(0)}%</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => run(() => api.pickAndInstall())}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted/60 transition hover:bg-veil/[0.06] hover:text-ink disabled:opacity-40"
        >
          <FolderOpen size={12} strokeWidth={2.2} />
          从文件导入
        </button>
        {installed && (
          <button
            onClick={() =>
              run(async () => {
                await api.remove()
                return { ok: true }
              })
            }
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted/50 transition hover:bg-err/10 hover:text-err disabled:opacity-40"
          >
            <Trash2 size={12} strokeWidth={2.2} />
            删除
          </button>
        )}
        {msg && <span className="ml-auto self-center text-[10.5px] text-muted/55">{msg}</span>}
      </div>
    </div>
  )
}
