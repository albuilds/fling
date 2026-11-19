import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type { RecordingAction, RecordingTimer } from "./app/types";

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
  get: (refresh = true) => ipcRenderer.invoke("auth:get", refresh),
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
  onError: (callback: (message: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, message: unknown) => callback(message);
    ipcRenderer.on("screenshot-overlay:error", listener);
    return () => ipcRenderer.removeListener("screenshot-overlay:error", listener);
  },
});

contextBridge.exposeInMainWorld("flingVideo", {
  closeOverlay: () => ipcRenderer.send("video-overlay:close"),
  start: (rect: unknown) => ipcRenderer.invoke("video-overlay:start", rect),
  reset: () => ipcRenderer.invoke("video-overlay:reset"),
  updateTimer: (timer: RecordingTimer) => ipcRenderer.send("video-overlay:timer", timer),
  onAction: (callback: (action: RecordingAction) => void) => {
    ipcRenderer.on("video-overlay:action", (_event, action: RecordingAction) => callback(action));
  },
  saveRecording: (data: ArrayBuffer, durationMs: number) =>
    ipcRenderer.invoke("video-overlay:save", data, durationMs),
});

contextBridge.exposeInMainWorld("flingRecordingControls", {
  sendAction: (action: RecordingAction) => ipcRenderer.send("recording-controls:action", action),
  onTimer: (callback: (timer: RecordingTimer) => void) => {
    ipcRenderer.on("recording-controls:timer", (_event, timer: RecordingTimer) => callback(timer));
  },
});
