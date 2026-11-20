/**
 * 离线语音包播放。
 *
 * 为什么不直接用系统语音合成：Windows 上常见的机器只装了中文音色
 * （Huihui / Kangkang / Yaoyao），程序只能拿中文音色念英文，音素映射不对，
 * 听感非常生硬；而且 Web Speech 的音量上限锁死在 1.0，也接不进 Web Audio
 * 增益链，音量提不上去。
 *
 * 这里改成播放预生成的神经语音 mp3（scripts/tts_pack.py 产出），走 Web Audio：
 * 音量可以放大、带淡入淡出、按峰值自动裁掉首尾静音。
 */

import voiceIndex from '@/data/voice-index.json'

const INDEX = voiceIndex as Record<string, string>

let ctx: AudioContext | null = null
let gain: GainNode | null = null
let current: AudioBufferSourceNode | null = null
/** 播放序号，用来作废「加载还没回来就已经被新请求取代」的播放 */
let seq = 0
/** 当前在播那段的归一化系数——用户拖音量滑块时要乘回去 */
let currentNorm = 1

/** 0–1 的界面音量 */
let vol = 1

/** 每条音频统一拉到 -18 dBFS 再送出去。
 *  实测原始素材 RMS 在 -21 ~ -24 dB 之间、词与词差 3 dB 左右，
 *  直接播会「这个词响那个词轻」，听起来很业余。 */
const TARGET_RMS = Math.pow(10, -18 / 20)
/** 归一化之后还剩的余量。实测 -18 dB 目标 + 压缩器已经到 -16 dB，
 *  再往上加就会削波，所以这里不再额外放大 */
const MAX_GAIN = 1

export interface Clip {
  buffer: AudioBuffer
  /** 裁掉首尾静音后的起点 / 终点（秒） */
  start: number
  end: number
  /** 把这段拉到 TARGET_RMS 需要的倍数 */
  norm: number
}

const clips = new Map<string, Clip>()
const pending = new Map<string, Promise<Clip | null>>()

function applyGain() {
  /* 人耳对响度的感知接近对数，滑块走 pow(x, 1.5) 才跟手感一致；
     直接线性的话前半段行程几乎听不出变化 */
  const g = currentNorm * MAX_GAIN * Math.pow(vol, 1.5)
  if (gain && ctx) gain.gain.setTargetAtTime(g, ctx.currentTime, 0.02)
}

export function setVoiceVolume(v: number) {
  vol = Math.min(1, Math.max(0, v))
  applyGain()
}

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      gain = ctx.createGain()
      /* 语音放大后峰值容易顶穿，用压缩器兜住：
         阈值 -9 dB、压缩比 8 是扫参数扫出来的——再松会削波，
         再紧会把词的重音一起压平，孩子就听不出该读重哪里了 */
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -9
      comp.knee.value = 6
      comp.ratio.value = 8
      comp.attack.value = 0.004
      comp.release.value = 0.2
      gain.connect(comp).connect(ctx.destination)
      applyGain()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 量一段音频：裁掉首尾静音，并算出该放大多少倍才到统一响度 */
function analyze(buffer: AudioBuffer): { start: number; end: number; norm: number } {
  const data = buffer.getChannelData(0)
  const n = data.length
  const thr = 0.012
  let i = 0
  while (i < n && Math.abs(data[i]) < thr) i += 1
  let j = n - 1
  while (j > i && Math.abs(data[j]) < thr) j -= 1
  if (i >= j) return { start: 0, end: buffer.duration, norm: 1 }

  const pad = 0.02
  const start = Math.max(0, i / buffer.sampleRate - pad)
  const end = Math.min(buffer.duration, j / buffer.sampleRate + pad)

  /* 只统计有声那段。神经语音每条尾巴都挂着近 1 秒静音，
     算整段的话 RMS 会被拖低一大截，归一化就白做了 */
  let sum = 0
  for (let k = i; k <= j; k += 1) sum += data[k] * data[k]
  const rms = Math.sqrt(sum / (j - i + 1))
  const norm = rms > 1e-5 ? Math.min(6, TARGET_RMS / rms) : 1
  return { start, end, norm }
}

async function bytesOf(hash: string): Promise<ArrayBuffer | null> {
  try {
    const api = window.spellpal
    /* 开发模式页面在 vite server 上，直接 fetch，不用绕主进程
       （那时 dist/ 可能是旧的，走 IPC 反而读到过期音频） */
    const overHttp = typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
    if (!overHttp && api?.readVoice) {
      const raw = await api.readVoice(hash)
      if (!raw) return null
      const arr = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer)
      return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
    }
    const res = await fetch(new URL(`voice/${hash}.mp3`, document.baseURI))
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

function load(text: string): Promise<Clip | null> {
  const cached = clips.get(text)
  if (cached) return Promise.resolve(cached)
  const running = pending.get(text)
  if (running) return running

  const hash = INDEX[text]
  if (!hash) return Promise.resolve(null)

  const job = (async () => {
    const c = ensureCtx()
    if (!c) return null
    const raw = await bytesOf(hash)
    if (!raw || !raw.byteLength) return null
    const buffer = await c.decodeAudioData(raw)
    const m = analyze(buffer)
    const clip: Clip = { buffer, start: m.start, end: m.end, norm: m.norm }
    clips.set(text, clip)
    return clip
  })()
    .catch(() => null)
    .finally(() => pending.delete(text)) as Promise<Clip | null>

  pending.set(text, job)
  return job
}

/** 提前把要读的音频取好并解码，点「听」的时候零等待 */
export function preloadClip(text: string): void {
  if (INDEX[text]) void load(text)
}

/** 这个词/句是否有离线音频（没有就退回系统语音合成） */
export function hasClip(text: string): boolean {
  return Boolean(INDEX[text])
}

export function stopClip() {
  /* 递增序号让还没加载完的播放失效：否则「点了停又马上点另一个」
     时，前一个的 load 晚到一步会把后一个挤掉 */
  seq += 1
  if (current) {
    try {
      current.stop()
    } catch {
      /* 已经播完 */
    }
    current = null
  }
}

/**
 * 播放。返回 false 表示没有这段音频，调用方应该退回系统语音合成。
 * 加载失败（文件缺失、解码出错）也会返回 false。
 */
export async function playClip(text: string): Promise<boolean> {
  const my = (seq += 1)
  const clip = await load(text)
  if (!clip) return false
  /* 加载期间又来了新的播放请求，这次就作废 */
  if (my !== seq) return true
  const c = ensureCtx()
  if (!c || !gain) return false

  stopClip()
  const src = c.createBufferSource()
  src.buffer = clip.buffer
  /* 左右声道都接到 gain；单声道也走同一条链 */
  src.connect(gain)
  const dur = Math.max(0.05, clip.end - clip.start)
  const t0 = c.currentTime + 0.005
  /* 每条音频响度归一化系数不同，playClip 前必须把增益重算一次，
     否则会沿用上一段的倍数，同一句话忽大忽小 */
  currentNorm = clip.norm
  gain.gain.setValueAtTime(clip.norm * MAX_GAIN * Math.pow(vol, 1.5), t0)
  src.start(t0, clip.start, dur)
  current = src
  src.onended = () => {
    if (current === src) current = null
  }
  return true
}

/** 当前已缓存的段数，自测用 */
export function cachedClipCount(): number {
  return clips.size
}

export function clipTotal(): number {
  return Object.keys(INDEX).length
}
