/** 极简合成音效，无需音频文件（Web Audio API） */

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sfx = {
  ok: () => tone(880, 0.05, 'triangle', 0.05),
  bad: () => tone(140, 0.11, 'sawtooth', 0.035),
  done: () => {
    tone(660, 0.09, 'sine', 0.055, 0)
    tone(880, 0.09, 'sine', 0.05, 0.07)
    tone(1180, 0.14, 'sine', 0.045, 0.14)
  },
  finish: () => {
    tone(523, 0.12, 'sine', 0.06, 0)
    tone(659, 0.12, 'sine', 0.055, 0.11)
    tone(784, 0.18, 'sine', 0.05, 0.22)
    tone(1046, 0.3, 'sine', 0.045, 0.33)
  },
}
