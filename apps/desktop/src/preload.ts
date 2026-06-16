import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("flingWindow", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
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
