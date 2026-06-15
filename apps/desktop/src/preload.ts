import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('flingWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
})

contextBridge.exposeInMainWorld('flingScreenshot', {
  closeOverlay: () => ipcRenderer.send('screenshot-overlay:close'),
  requestScreenshot: () => ipcRenderer.send('screenshot-overlay:screenshot'),
  onPending: (callback: () => void) => ipcRenderer.on('screenshot-overlay:pending', callback),
})
