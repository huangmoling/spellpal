/**
 * 合成音效，不依赖任何音频文件（Web Audio API）。
 * 成功 / 错误各 8 种，孩子在设置里自己挑。
 */

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
/** 总音量 0–1，设置页拖动时实时生效 */
let masterVol = 1

/**
 * 单个音的增益补偿。原来成功音只有 0.03–0.1，母线再乘 0.8，
 * 系统音量开满也只有蚊子叫，家长根本听不见。这里统一提一档。
 */
const TRIM = 1.5
/** 母线额外放大。叠加音会超过 1.0，所以后面串一个软限幅，别直接爆音 */
const BOOST = 2

/** 设置页调音量用。0 就是静音，但朗读不受影响（朗读有单独的 speechVolume） */
export function setSfxVolume(v: number) {
  masterVol = Math.min(1, Math.max(0, v))
  if (bus && ctx) bus.gain.setTargetAtTime(masterVol * BOOST, ctx.currentTime, 0.01)
}

/** tanh 软限幅：1.0 以上的峰值压回去，听感是「响但不炸」 */
function makeShaper(c: AudioContext): WaveShaperNode {
  const shaper = c.createWaveShaper()
  const n = 2048
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.6)
  }
  shaper.curve = curve
  shaper.oversample = '2x'
  return shaper
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      bus = ctx.createGain()
      bus.gain.value = masterVol * BOOST
      bus.connect(makeShaper(ctx)).connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

const out = (c: AudioContext) => bus ?? c.destination

/** 一个音。slideTo 给滑音用（比如「泡泡」的上升） */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  slideTo?: number,
) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.min(0.95, gain * TRIM), t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(out(c))
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

/** 一段带通白噪声，用来做沙锤、敲桌这类打击感 */
function noise(dur: number, gain: number, delay = 0, cutoff = 1600) {
  const c = ac()
  if (!c) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = cutoff
  f.Q.value = 0.9
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.min(0.95, gain * TRIM), t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(out(c))
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

export interface SfxPreset {
  name: string
  play: () => void
}

/** 拼对整句时播的 8 种 */
export const SUCCESS_SFX: SfxPreset[] = [
  {
    name: '清亮三连',
    play: () => {
      tone(784, 0.12, 'sine', 0.1, 0)
      tone(988, 0.12, 'sine', 0.09, 0.09)
      tone(1319, 0.28, 'sine', 0.085, 0.18)
    },
  },
  {
    name: '木琴上行',
    play: () => {
      ;[1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.13, 'triangle', 0.075, i * 0.075))
    },
  },
  {
    name: '风铃',
    play: () => {
      ;[1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.42, 'sine', 0.045, i * 0.055))
      noise(0.26, 0.018, 0, 4200)
    },
  },
  {
    name: '小号三音',
    play: () => {
      tone(523, 0.15, 'square', 0.04, 0)
      tone(659, 0.15, 'square', 0.04, 0.13)
      tone(784, 0.32, 'square', 0.038, 0.26)
    },
  },
  {
    name: '电子上升',
    play: () => {
      tone(320, 0.4, 'sawtooth', 0.038, 0, 1280)
      tone(640, 0.3, 'sine', 0.05, 0.12, 1920)
    },
  },
  {
    name: '大三和弦',
    play: () => {
      ;[523, 659, 784].forEach((f) => tone(f, 0.44, 'sine', 0.055, 0))
      tone(1046, 0.5, 'sine', 0.03, 0.09)
    },
  },
  {
    name: '泡泡',
    play: () => {
      tone(240, 0.09, 'sine', 0.075, 0, 720)
      tone(360, 0.09, 'sine', 0.06, 0.08, 1080)
      tone(520, 0.14, 'sine', 0.05, 0.16, 1560)
    },
  },
  {
    name: '撒花沙锤',
    play: () => {
      for (let i = 0; i < 5; i++) noise(0.09, 0.05, i * 0.06, 2400)
      tone(1046, 0.2, 'sine', 0.05, 0.12)
      tone(1568, 0.3, 'sine', 0.035, 0.2)
    },
  },
]

/** 拼错时播的 8 种 */
export const ERROR_SFX: SfxPreset[] = [
  {
    name: '短促噗',
    play: () => {
      noise(0.09, 0.1, 0, 520)
    },
  },
  {
    name: '低沉嗡',
    play: () => {
      tone(112, 0.16, 'sine', 0.1, 0, 92)
    },
  },
  {
    name: '下滑',
    play: () => {
      tone(400, 0.18, 'triangle', 0.07, 0, 180)
    },
  },
  {
    name: '木鱼两下',
    play: () => {
      tone(220, 0.06, 'square', 0.045, 0)
      tone(196, 0.08, 'square', 0.045, 0.1)
    },
  },
  {
    name: '警示',
    play: () => {
      tone(440, 0.08, 'square', 0.04, 0)
      tone(415, 0.1, 'square', 0.04, 0.1)
    },
  },
  {
    name: '电子嗡嗡',
    play: () => {
      tone(88, 0.22, 'sawtooth', 0.04, 0)
      tone(92, 0.22, 'sawtooth', 0.032, 0.02)
    },
  },
  {
    name: '敲桌',
    play: () => {
      noise(0.05, 0.12, 0, 320)
      tone(140, 0.05, 'triangle', 0.045, 0)
    },
  },
  {
    name: '失望三连',
    play: () => {
      tone(392, 0.12, 'sine', 0.075, 0)
      tone(330, 0.12, 'sine', 0.075, 0.1)
      tone(262, 0.22, 'sine', 0.07, 0.2)
    },
  },
]

export const playSuccess = (i: number) => (SUCCESS_SFX[i] ?? SUCCESS_SFX[0]).play()
export const playError = (i: number) => (ERROR_SFX[i] ?? ERROR_SFX[0]).play()

/**
 * 每敲对一个字母的按键音，8 种。
 * 全部做得很短很轻（20–45ms），否则一整句几十下会盖住朗读。
 */
export const KEY_SFX: SfxPreset[] = [
  {
    name: '轻声',
    play: () => tone(1320, 0.022, 'triangle', 0.016),
  },
  {
    name: '木鱼',
    play: () => {
      tone(560, 0.03, 'square', 0.012)
      noise(0.02, 0.012, 0, 900)
    },
  },
  {
    name: '打字机',
    play: () => {
      noise(0.028, 0.026, 0, 2600)
      tone(180, 0.03, 'triangle', 0.012)
    },
  },
  {
    name: '水滴',
    play: () => {
      tone(1400, 0.05, 'sine', 0.022, 0, 700)
    },
  },
  {
    name: '拨弦',
    play: () => {
      tone(760, 0.045, 'triangle', 0.02, 0, 520)
    },
  },
  {
    name: '咔哒',
    play: () => {
      noise(0.016, 0.03, 0, 3400)
    },
  },
  {
    name: '电子',
    play: () => {
      tone(1800, 0.018, 'square', 0.01)
    },
  },
  {
    name: '纸片',
    play: () => {
      noise(0.02, 0.022, 0, 5200)
      noise(0.014, 0.014, 0.014, 3000)
    },
  },
]

export const playKey = (i: number) => (KEY_SFX[i] ?? KEY_SFX[0]).play()

/** 打字过程中的极轻点击，别盖过语音 */
export const tick = () => tone(1320, 0.022, 'triangle', 0.016)

/** 整册打完的收尾音 */
export const playFinish = (i: number) => {
  playSuccess(i)
  tone(1046, 0.5, 'sine', 0.035, 0.42)
  tone(1319, 0.7, 'sine', 0.03, 0.54)
}

/** 兼容旧调用 */
export const sfx = {
  ok: tick,
  bad: () => playError(0),
  done: () => playSuccess(0),
  finish: () => playFinish(0),
}
