/**
 * 发音。
 *
 * 优先播离线语音包（src/utils/voice.ts，scripts/tts_pack.py 预生成）；
 * 索引里没有的文本——比如拼字母提示、以后新加还没补音频的词——才退回
 * 系统语音合成。两条路的优先级写在这里，调用方不用管。
 *
 * 退回 TTS 的注意点：Electron 首次调用 getVoices() 可能返回空数组，
 * 需要 voiceschanged 兜底。
 */

import { hasClip, playClip, setVoiceVolume, stopClip } from './voice'

let cached: SpeechSynthesisVoice | null = null
let warmed = false
/** 朗读音量 0–1。系统和音效各调各的，孩子听英文时音效不该更响 */
let speechVol = 1

export function setSpeechVolume(v: number) {
  speechVol = Math.min(1, Math.max(0, v))
  /* 离线音频走 Web Audio 增益（可以放到 2 倍以上），TTS 只能卡在 1.0 */
  setVoiceVolume(speechVol)
}

/**
 * 优先挑英文音色。
 * 之前这里只按 en-* 过滤，没有英文音色时返回 null，结果 Chromium 拿系统
 * 默认的中文音色念英文，音素映射全乱，听着非常生硬。现在分三档：
 * 英文音色 → 任意音色（至少能读） → null。
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const en = voices.filter((v) => /^en[-_]/i.test(v.lang))
  if (!en.length) return voices[0] ?? null

  const prefer = ['Google US English', 'Microsoft Zira', 'Microsoft Jenny', 'Microsoft Aria', 'Samantha']
  for (const name of prefer) {
    const hit = en.find((v) => v.name.includes(name))
    if (hit) return hit
  }
  const gb = en.find((v) => /en[-_]GB/i.test(v.lang))
  return gb ?? en[0]
}

export function warmupSpeech() {
  if (warmed || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  warmed = true
  cached = pickVoice()
  window.speechSynthesis.onvoiceschanged = () => {
    cached = pickVoice()
  }
}

export interface SpeakOptions {
  rate?: number
  /** 只读单个字母时用（挖空提示），必须走 TTS，不能拿整词音频顶上 */
  spell?: boolean
}

function ttsSpeak(text: string, opts: SpeakOptions): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  if (!cached) cached = pickVoice()

  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = cached && /^en[-_]/i.test(cached.lang) ? cached.lang : 'en-US'
  if (cached) u.voice = cached
  u.rate = opts.rate ?? (opts.spell ? 0.7 : 0.82)
  u.pitch = 1
  /* TTS 的 volume 是线性的且上限 1.0，用下凹曲线把可用行程拉开 */
  u.volume = Math.min(1, Math.pow(speechVol, 0.45))
  synth.speak(u)
  return true
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!text.trim()) return false
  if (typeof window === 'undefined') return false

  stopClip()
  if (!opts.spell && hasClip(text)) {
    /* 命中离线音频就播它；万一文件缺失或解码失败，再退回系统语音 */
    void playClip(text).then((ok) => {
      if (!ok) ttsSpeak(text, opts)
    })
    return true
  }
  return ttsSpeak(text, opts)
}

/** 系统里是否有可用的发音（离线音频包不算，它是自己带的） */
export function speechReady(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  return window.speechSynthesis.getVoices().some((v) => /^en[-_]/i.test(v.lang))
}
