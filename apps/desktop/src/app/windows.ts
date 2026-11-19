// Creates the app's windows with locked-down security settings.

import { app, BrowserWindow, session } from "electron";
import { ICON_PATH, isTrustedAppUrl, pagePath, PRELOAD_PATH } from "./paths";
import type { AppPage } from "./paths";

/**
 * Renderer pages get no Node.js access. They can only use the small API that
 * preload.ts exposes through contextBridge.
 */
const SECURE_WEB_PREFERENCES: Electron.WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  preload: PRELOAD_PATH,
  sandbox: true,
  webSecurity: true,
};

/** Blocks pop-ups and navigation to anything other than the app's pages. */
function hardenWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
}

function closeWhenCapturePageLeaves(window: BrowserWindow) {
  const close = () => {
    if (!window.isDestroyed()) window.destroy();
  };
  window.webContents.on("render-process-gone", close);
  window.webContents.once("did-finish-load", () => {
    window.webContents.on("did-start-navigation", ({ isMainFrame, isSameDocument }) => {
      // A development reload replaces the renderer that owns the capture.
      if (isMainFrame && !isSameDocument) setImmediate(close);
    });
  });
}

function isTrustedWebContents(webContents: Electron.WebContents | null) {
  return isTrustedAppUrl(webContents?.getURL() ?? "");
}

/** Only the app's own pages may use the microphone or capture the screen. */
export function registerMediaPermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === "media" && isTrustedWebContents(webContents);
  });

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      callback(
        (permission === "media" || permission === "display-capture") &&
          isTrustedWebContents(webContents),
      );
    },
  );
}

/** The main settings window. Closing it hides it so the tray app keeps running. */
export function createMainWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    skipTaskbar: true,
    frame: false,
    // Taskbar and window icon on Windows and Linux (macOS uses the Dock icon).
    icon: ICON_PATH,
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  hardenWindow(window);
  window.loadFile(pagePath("index.html"));
  window.on("close", (event) => {
    event.preventDefault();
    window.hide();
  });
  return window;
}

/**
 * A transparent, always-on-top window covering one whole display, including
 * the macOS menu bar and the Windows taskbar, used to select a screenshot or
 * recording region. One is created per monitor.
 */
export function createOverlayWindow(
  page: AppPage,
  display: Electron.Display,
  { focus }: { focus: boolean },
) {
  const { bounds } = display;
  const useFullscreen = process.platform === "win32";
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    fullscreen: useFullscreen,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: useFullscreen,
    skipTaskbar: true,
    alwaysOnTop: true,
    // macOS normally keeps windows below the menu bar; this lets the overlay
    // cover the full display so the top of the screen can be captured too.
    enableLargerThanScreen: true,
    // Fling runs in the background, so the overlay is usually not the active
    // app. Without this, macOS uses the first click only to activate the
    // window and the button under the pointer does nothing.
    acceptFirstMouse: true,
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      backgroundThrottling: page !== "video-overlay.html",
    },
  });
  hardenWindow(window);
  closeWhenCapturePageLeaves(window);

  // "screen-saver" is the highest level, so the overlay sits above the menu
  // bar, Dock, and taskbar.
  window.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    // Also appear over apps running in full-screen spaces.
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
    window.setBounds(bounds);
  }
  window.setFullScreen(useFullscreen);
  void window.loadFile(pagePath(page)).catch((error) => {
    if (window.isDestroyed()) return;
    console.error(`Could not open ${page}:`, error);
    window.destroy();
  });
  window.once("ready-to-show", () => {
    if (focus) {
      window.show();
      // Fling runs in the background, so take focus explicitly to receive
      // Esc and Enter.
      if (process.platform === "darwin") app.focus({ steal: true });
      window.focus();
    } else {
      showWithoutFocus(window);
    }
  });
  return window;
}

export function showWithoutFocus(window: BrowserWindow) {
  // showInactive is unavailable on Wayland.
  if (process.platform === "linux") window.show();
  else window.showInactive();
}

/** The recording border is visible but never intercepts clicks. */
export function setOverlayClickThrough(window: BrowserWindow, enabled: boolean) {
  window.setIgnoreMouseEvents(enabled);
  if (process.platform === "darwin" || process.platform === "win32") {
    window.setFocusable(!enabled);
  }
  if (enabled) window.blur();
}

/** A native hit area for the timer and buttons on top of the recording border. */
export function createRecordingControls(bounds: Electron.Rectangle) {
  const window = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    enableLargerThanScreen: true,
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  hardenWindow(window);
  closeWhenCapturePageLeaves(window);
  window.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
    window.setBounds(bounds);
  }
  return window;
}
