/**
 * 用 CDP 在 headless Edge 里点一下再截图（本机 electron 截图脚本在沙箱里起不来时的替代方案）
 *   node scripts/shot-cdp.mjs <out.png> "<要执行的 JS 表达式>" [等待毫秒]
 */
import fs from 'node:fs'

const out = process.argv[2] || 'shot.png'
const expr = process.argv[3] || '1'
const wait = Number(process.argv[4] || 900)
const port = Number(process.env.CDP_PORT || 9222)

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page =
  list.find((t) => t.type === 'page' && t.url.includes('index.html')) ||
  list.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')
console.log('target:', page.url)

const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })

await new Promise((r) => ws.addEventListener('open', r))
await send('Runtime.enable')

const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log('eval:', JSON.stringify(res.result?.result?.value ?? res.result))
await new Promise((r) => setTimeout(r, wait))

const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log('saved', out)
ws.close()
