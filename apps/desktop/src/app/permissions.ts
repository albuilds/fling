// macOS Screen Recording permission.
//
// Without it, macOS silently refuses screen capture and Electron only reports
// "Failed to get sources". These helpers check first and explain how to fix
// it instead of failing quietly.

import { app, desktopCapturer, dialog, shell, systemPreferences } from "electron";

const PRIVACY_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

let isShowingHelp = false;

/** True unless macOS has definitely denied screen capture. */
export function mayCaptureScreen() {
  if (process.platform !== "darwin") return true;
  const status = systemPreferences.getMediaAccessStatus("screen");
  return status === "granted" || status === "not-determined";
}

/** Errors that mean the capture failed because permission is missing. */
export function isPermissionError(error: unknown) {
  if (process.platform !== "darwin") return false;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to get sources|permission|not allowed|denied/i.test(message);
}

/**
 * Explains how to grant Screen Recording and offers to open the right
 * System Settings pane. Only one dialog is shown at a time.
 */
export async function showScreenCaptureHelp() {
  if (isShowingHelp) return;
  isShowingHelp = true;

  // Asking for sources once makes macOS list this app in System Settings
  // (and shows the system prompt the first time).
  await desktopCapturer
    .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    .catch(() => undefined);

  const detail = app.isPackaged
    ? "Turn on Fling in System Settings → Privacy & Security → Screen & System Audio Recording, then quit and reopen Fling."
    : "Fling is running in development, so macOS checks the app that started it. Turn on your terminal or editor (for example, Visual Studio Code) in System Settings → Privacy & Security → Screen & System Audio Recording, then quit and reopen that app.";

  try {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      message: "Fling needs Screen Recording permission",
      detail,
      buttons: ["Open System Settings", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) await shell.openExternal(PRIVACY_SETTINGS_URL);
  } finally {
    isShowingHelp = false;
  }
}

/** Returns true when capture can go ahead; otherwise shows the help dialog. */
export async function ensureScreenCaptureAccess() {
  if (mayCaptureScreen()) return true;
  await showScreenCaptureHelp();
  return false;
}
