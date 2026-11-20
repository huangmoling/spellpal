/**
 * 离线语音包的读取通道（主进程侧）。
 *
 * 打包后渲染进程的页面在 file:// 下，fetch 读不到本地文件，只能由主进程
 * 读 mp3 再通过 IPC 交回去。main.cjs 与 scripts/verify.cjs 都要注册这一个
 * handler，所以抽出来共用，避免两边逻辑漂移。
 */

const fs = require('node:fs')
const path = require('node:path')

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {string} distDir 构建产物目录（里面有 voice/ 子目录）
 */
function registerVoiceIpc(ipcMain, distDir) {
  ipcMain.handle('voice:read', async (_e, hash) => {
    const key = String(hash || '')
    /* 只接受 12 位小写十六进制，防止渲染进程被注入后拼路径读到别的文件 */
    if (!/^[0-9a-f]{12}$/.test(key)) return null
    try {
      return await fs.promises.readFile(path.join(distDir, 'voice', `${key}.mp3`))
    } catch {
      return null
    }
  })
}

module.exports = { registerVoiceIpc }
