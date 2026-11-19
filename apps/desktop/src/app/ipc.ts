// Wrappers around ipcMain that only accept messages from the app's own pages.
//
// Every window is already locked to local pages, but checking the sender on
// each message means a page that somehow loaded other content still could
// not call into the main process (for example, to upload files, open links,
// or sign the device out).

import { ipcMain } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { isTrustedAppUrl } from "./paths";

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  return Boolean(url && isTrustedAppUrl(url));
}

/** Registers a request/response handler (renderer uses ipcRenderer.invoke). */
export function handle(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Rejected ${channel} from an untrusted page`);
    }
    return handler(event, ...args);
  });
}

/** Registers a one-way message listener (renderer uses ipcRenderer.send). */
export function on(
  channel: string,
  listener: (event: IpcMainEvent, ...args: unknown[]) => void,
) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      console.warn(`Ignored ${channel} from an untrusted page`);
      return;
    }
    listener(event, ...args);
  });
}
