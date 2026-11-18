const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('spellpal', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  setTheme: (t) => ipcRenderer.send('app:theme', t),
  /* 系统侧（Alt+F4 / 任务栏）发起关闭时，主进程会先问一句 */
  onAskClose: (cb) => {
    const h = () => cb()
    ipcRenderer.on('app:ask-close', h)
    return () => ipcRenderer.removeListener('app:ask-close', h)
  },
  closeConfirmed: () => ipcRenderer.send('win:close-confirmed'),
})
