import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('flingWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
})
