const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('spellpal', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  setTheme: (t) => ipcRenderer.send('app:theme', t),
})
