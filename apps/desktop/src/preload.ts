import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("flingWindow", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
});

contextBridge.exposeInMainWorld("flingSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  save: (settings: unknown) => ipcRenderer.invoke("settings:save", settings),
  reset: () => ipcRenderer.invoke("settings:reset"),
});

contextBridge.exposeInMainWorld("flingScreenshot", {
  closeOverlay: () => ipcRenderer.send("screenshot-overlay:close"),
  requestScreenshot: (rect: unknown, options: unknown) =>
    ipcRenderer.send("screenshot-overlay:screenshot", rect, options),
  onPending: (callback: () => void) =>
    ipcRenderer.on("screenshot-overlay:pending", callback),
  onSaved: (callback: (_event: IpcRendererEvent, savedPath: string) => void) =>
    ipcRenderer.on("screenshot-overlay:saved", callback),
  onError: (callback: () => void) =>
    ipcRenderer.on("screenshot-overlay:error", callback),
});

contextBridge.exposeInMainWorld("flingVideo", {
  closeOverlay: () => ipcRenderer.send("video-overlay:close"),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.invoke("video-overlay:set-ignore-mouse-events", ignore),
  setRecordingRegion: (rect: unknown) =>
    ipcRenderer.invoke("video-overlay:set-recording-region", rect),
  getScreenSource: () => ipcRenderer.invoke("video-overlay:get-source"),
  saveRecording: (data: ArrayBuffer) => ipcRenderer.invoke("video-overlay:save", data),
});
