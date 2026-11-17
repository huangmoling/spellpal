/**
 * 发音 —— 走浏览器内置语音合成（Windows SAPI），完全离线，不需要音频文件。
 *
 * 注意：Electron 首次调用时 getVoices() 可能返回空数组，需要用 voiceschanged 兜底。
 */

let cached: SpeechSynthesisVoice | null = null
let warmed = false

/** 优先挑一个英音/美音的女声，听起来更接近教材录音 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const en = voices.filter((v) => /^en[-_]/i.test(v.lang))
  if (!en.length) return null

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
  /** 只读单个字母时用（挖空提示） */
  spell?: boolean
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  if (!text.trim()) return false
  if (!cached) cached = pickVoice()

  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = cached?.lang ?? 'en-US'
  if (cached) u.voice = cached
  u.rate = opts.rate ?? (opts.spell ? 0.7 : 0.82)
  u.pitch = 1
  u.volume = 1
  synth.speak(u)
  return true
}

/** 系统里是否有可用的英文发音 */
export function speechReady(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  return window.speechSynthesis.getVoices().some((v) => /^en[-_]/i.test(v.lang))
}
