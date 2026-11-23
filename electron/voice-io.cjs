/**
 * 离线语音包的读取通道（主进程侧）。
 *
 * 打包后渲染进程的页面在 file:// 下，fetch 读不到本地文件，只能由主进程
 * 读 mp3 再通过 IPC 交回去。main.cjs 与 scripts/verify.cjs 都要注册这一个
 * handler，所以抽出来共用，避免两边逻辑漂移。
 *
 * 0.19 起语音包与安装包分离，音频有两个来源，按顺序找：
 *   1. userData/voice —— 首次启动下载的外置包（绝大多数用户走这条）
 *   2. <distDir>/voice —— 包内自带的那份，开发模式与老版本升级过渡用
 */

const fs = require('node:fs')
const path = require('node:path')

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {string} distDir 构建产物目录（里面有 voice/ 子目录）
 * @param {string[]} [extraRoots] 额外搜索目录，外置语音包放在第一位
 */
function registerVoiceIpc(ipcMain, distDir, extraRoots = []) {
  /* 目录列表在启动时算好即可：外置包装好后会通知渲染进程 reload，
     不需要每次读文件都问一遍磁盘 */
  const roots = [...extraRoots.filter(Boolean), path.join(distDir, 'voice')]

  ipcMain.handle('voice:read', async (_e, hash) => {
    const key = String(hash || '')
    /* 只接受 12 位小写十六进制，防止渲染进程被注入后拼路径读到别的文件 */
    if (!/^[0-9a-f]{12}$/.test(key)) return null
    for (const root of roots) {
      try {
        return await fs.promises.readFile(path.join(root, `${key}.mp3`))
      } catch {
        /* 换下一个来源 */
      }
    }
    return null
  })

  /** 返回当前实际可用的搜索路径，自测与排障用 */
  ipcMain.handle('voice:roots', () => roots)
}

module.exports = { registerVoiceIpc }
