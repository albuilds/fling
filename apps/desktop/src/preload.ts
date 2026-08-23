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

contextBridge.exposeInMainWorld("flingAuth", {
  get: () => ipcRenderer.invoke("auth:get"),
  signIn: () => ipcRenderer.invoke("auth:sign-in"),
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
  onPending: (callback: (data: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("auth:pending", listener);
    return () => ipcRenderer.removeListener("auth:pending", listener);
  },
  onComplete: (callback: (data: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("auth:complete", listener);
    return () => ipcRenderer.removeListener("auth:complete", listener);
  },
  onError: (callback: (data: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("auth:error", listener);
    return () => ipcRenderer.removeListener("auth:error", listener);
  },
});

contextBridge.exposeInMainWorld("flingHistory", {
  list: () => ipcRenderer.invoke("history:list"),
  copyLink: (url: string) => ipcRenderer.invoke("history:copy-link", url),
  openLink: (url: string) => ipcRenderer.invoke("history:open-link", url),
  onChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("history:changed", listener);
    return () => ipcRenderer.removeListener("history:changed", listener);
  },
});

contextBridge.exposeInMainWorld("flingScreenshot", {
  closeOverlay: () => ipcRenderer.send("screenshot-overlay:close"),
  requestScreenshot: (rect: unknown, options: unknown) =>
    ipcRenderer.send("screenshot-overlay:screenshot", rect, options),
  onPending: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("screenshot-overlay:pending", listener);
    return () => ipcRenderer.removeListener("screenshot-overlay:pending", listener);
  },
  onSaved: (callback: (savedPath: string) => void) => {
    const listener = (_event: IpcRendererEvent, savedPath: string) =>
      callback(savedPath);
    ipcRenderer.on("screenshot-overlay:saved", listener);
    return () => ipcRenderer.removeListener("screenshot-overlay:saved", listener);
  },
  onError: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("screenshot-overlay:error", listener);
    return () => ipcRenderer.removeListener("screenshot-overlay:error", listener);
  },
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
