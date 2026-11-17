import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

/**
 * 整句拼完的烟花。canvas 铺在练习区上，pointer-events 关掉，不挡点击。
 * burst 每次自增放一轮，0 表示还没放过。
 */
export default function Fireworks({ burst }: { burst: number }) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  const parts = useRef<Particle[]>([])
  const raf = useRef(0)

  useEffect(() => {
    if (!burst) return
    const cv = cvRef.current
    const parent = cv?.parentElement
    if (!cv || !parent) return

    const w = parent.clientWidth
    const h = parent.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`

    /* 先清空上一轮的粒子，再放新的——顺序反了会把刚生成的也清掉 */
    parts.current = []
    window.cancelAnimationFrame(raf.current)

    const spawn = (cx: number, cy: number, count: number) => {
      const hue = Math.floor(Math.random() * 360)
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Math.random() * 0.35
        const sp = 1.4 + Math.random() * 3.8
        parts.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 0.7,
          life: 0,
          max: 62 + Math.random() * 46,
          color: `hsl(${hue + Math.random() * 56 - 28} 96% ${62 + Math.random() * 14}%)`,
          size: 1.7 + Math.random() * 2.1,
        })
      }
    }

    spawn(w * (0.28 + Math.random() * 0.12), h * (0.3 + Math.random() * 0.1), 56)
    const t1 = window.setTimeout(
      () => spawn(w * (0.56 + Math.random() * 0.16), h * (0.22 + Math.random() * 0.12), 58),
      170,
    )
    const t2 = window.setTimeout(
      () => spawn(w * (0.38 + Math.random() * 0.24), h * (0.44 + Math.random() * 0.08), 46),
      420,
    )

    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const step = () => {
      ctx.clearRect(0, 0, w, h)
      const alive: Particle[] = []
      for (const p of parts.current) {
        p.life += 1
        p.vy += 0.042
        p.vx *= 0.986
        p.vy *= 0.986
        p.x += p.vx
        p.y += p.vy
        const t = p.life / p.max
        if (t >= 1) continue
        alive.push(p)
        const alpha = 1 - t * t * 0.9
        ctx.globalAlpha = alpha
        ctx.strokeStyle = p.color
        ctx.shadowBlur = 7
        ctx.shadowColor = p.color
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        ctx.globalAlpha = alpha * 0.85
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      parts.current = alive
      if (alive.length) raf.current = requestAnimationFrame(step)
      else {
        ctx.clearRect(0, 0, w, h)
        raf.current = 0
      }
    }

    raf.current = requestAnimationFrame(step)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.cancelAnimationFrame(raf.current)
      raf.current = 0
      parts.current = []
    }
  }, [burst])

  return <canvas ref={cvRef} className="pointer-events-none absolute inset-0 z-30" />
}
