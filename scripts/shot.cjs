/**
 * 开发用截图脚本（离屏渲染，无需真实窗口）
 *   electron scripts/shot.cjs <url> <out.png> [w] [h]
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const url = process.argv[2] || 'http://localhost:5173'
const out = process.argv[3] || 'shot.png'
const w = Number(process.argv[4] || 1200)
const h = Number(process.argv[5] || 800)

const LOG = path.join(path.dirname(out), 'shot.log')
const log = (m) => {
  try {
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`)
  } catch {}
}
try {
  fs.writeFileSync(LOG, '')
} catch {}

process.on('uncaughtException', (e) => log('UNCAUGHT ' + (e && e.stack)))
process.on('unhandledRejection', (e) => log('REJECT ' + (e && e.stack)))

log('boot pid=' + process.pid)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  log('ready fired')
  try {
    const win = new BrowserWindow({
      width: w,
      height: h,
      show: false,
      frame: false,
      backgroundColor: '#0B0E13',
      webPreferences: { offscreen: true },
    })
    log('window created')

    win.webContents.on('did-fail-load', (_e, code, desc) => log(`fail-load ${code} ${desc}`))
    win.webContents.on('did-finish-load', () => log('finish-load'))

    await win.loadURL(url)
    log('url loaded')
    await new Promise((r) => setTimeout(r, 2000))

    const img = await win.webContents.capturePage()
    fs.writeFileSync(out, img.toPNG())
    log('saved ' + JSON.stringify(img.getSize()))
  } catch (e) {
    log('ERR ' + (e && e.stack))
  }
  app.exit(0)
})
