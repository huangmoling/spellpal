const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('spellpal', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
})
