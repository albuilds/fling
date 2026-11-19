// Wires the app together: windows, tray menu, keyboard shortcuts, and the
// IPC channels the pages use. The pieces it coordinates live in their own
// modules (settings, device session, API client, capture, windows).

import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  Notification,
  shell,
  Tray,
} from "electron";
import fs from "fs/promises";
import path from "path";
import { DeviceSession } from "./device-session";
import { FlingApi } from "./fling-api";
import { clampScreenshotRect, getRecordingControlsBounds, parseRect } from "./geometry";
import * as ipc from "./ipc";
import { ICON_PATH, MAC_TRAY_ICON_PATH, pagePath } from "./paths";
import {
  ensureScreenCaptureAccess,
  isPermissionError,
  showScreenCaptureHelp,
} from "./permissions";
import type { AppPage } from "./paths";
import { captureDisplay, getCursorDisplay, getScreenSourceId } from "./screen-capture";
import {
  cloneSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeScreenshotOptions,
  normalizeSettings,
  saveSettings,
} from "./settings";
import type { DeviceUser, FlingSettings } from "./types";
import { normalizeApiBaseUrl, toTrustedServerUrl } from "./urls";
import { isFiniteNumber } from "./validation";
import {
  createMainWindow,
  createOverlayWindow,
  createRecordingControls,
  registerMediaPermissions,
  setOverlayClickThrough,
  showWithoutFocus,
} from "./windows";

/** Delay so the overlay is fully hidden before the screen is captured. */
const OVERLAY_HIDE_DELAY_MS = 160;
/** How long the "Signed in" screen stays up before the main page opens. */
const SIGN_IN_SUCCESS_DELAY_MS = 1400;
const RECORDING_ACTIONS = ["cancel", "redo", "pause", "finish"];

type RecordingSession = {
  overlay: BrowserWindow;
  controls: BrowserWindow;
  save: Promise<string> | null;
};

/**
 * Local time in a readable, filename-safe form, matching macOS screenshots:
 * "2026-11-18 at 20.51.22". The name doubles as the capture's title on the
 * website, so it should read well.
 */
function timestampForFileName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  return `${day} at ${time}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Which display each overlay window covers, by webContents id. */
const overlayDisplays = new Map<number, Electron.Display>();

function closeAll(windows: BrowserWindow[]) {
  for (const window of windows) {
    if (!window.isDestroyed()) window.destroy();
  }
}

/** The overlay window an IPC message came from, and the display it covers. */
function getOverlaySender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);
  const display = overlayDisplays.get(event.sender.id);
  return window && display ? { window, display } : null;
}

/** A short, human explanation of why an upload failed. */
function describeUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
    return "The Fling server isn't reachable. Is it running?";
  }
  if (/\(401\)/.test(message)) return "This device was signed out. Sign in again.";
  if (/\(413\)/.test(message)) return "The file is larger than the upload limit.";
  return "Try again in a moment.";
}

export class FlingApp {
  private readonly apiBaseUrl = normalizeApiBaseUrl(
    process.env.FLING_API_URL || "http://localhost:3000",
  );
  private readonly session = new DeviceSession(this.apiBaseUrl, () =>
    this.updateTrayMenu(),
  );
  private readonly api = new FlingApi(this.apiBaseUrl, this.session);

  private settings: FlingSettings = cloneSettings(DEFAULT_SETTINGS);
  private tray: Tray | null = null;
  private win: BrowserWindow | null = null;
  /** Screenshot overlays, one per display while selecting a region. */
  private screenshotOverlays: BrowserWindow[] = [];
  /** Recording overlays, one per display until a recording starts. */
  private videoOverlays: BrowserWindow[] = [];
  /** True while a screenshot is being taken and saved. */
  private isCapturing = false;
  private recording: RecordingSession | null = null;

  async start() {
    app.setAppUserModelId("fling");
    if (process.platform === "darwin") {
      this.applyDockIcon();
    }
    Menu.setApplicationMenu(null);

    this.settings = await loadSettings();
    this.applyTheme();
    await this.session.restore();

    registerMediaPermissions();
    this.registerWindowControls();
    this.registerSettingsControls();
    this.registerAuthControls();
    this.registerHistoryControls();
    this.registerScreenshotControls();
    this.registerVideoControls();

    if (process.platform === "darwin") app.dock?.hide();
    this.win = createMainWindow();
    // Leave the Dock and taskbar whenever the window is hidden (closing hides it).
    this.win.on("hide", () => this.setInDockAndTaskbar(false));
    this.createTray();
    this.registerGlobalShortcuts();
    if (!this.session.state.signedIn) this.showPage("sign-in.html");
  }

  // ---- Windows -----------------------------------------------------------

  private showPage(page: AppPage) {
    this.win?.loadFile(pagePath(page));
    this.showMainWindow();
  }

  private showMainWindow() {
    if (!this.win) return;
    this.setInDockAndTaskbar(true);
    this.win.show();
    if (process.platform === "darwin") app.focus({ steal: true });
    this.win.focus();
  }

  private applyDockIcon() {
    if (process.platform !== "darwin") return;
    const icon = nativeImage.createFromPath(ICON_PATH);
    if (!icon.isEmpty()) app.dock?.setIcon(icon);
  }

  /**
   * Fling lives in the menu bar / system tray. It only appears in the Dock
   * (macOS) or taskbar (Windows) while its window is open.
   */
  private setInDockAndTaskbar(visible: boolean) {
    if (process.platform === "darwin") {
      if (visible) {
        // macOS falls back to Electron's own icon each time the Dock icon is
        // shown again, so set the Fling icon after every show.
        void app.dock?.show().then(() => this.applyDockIcon());
      } else {
        app.dock?.hide();
      }
    }
    this.win?.setSkipTaskbar(!visible);
  }

  /*
   * Overlays: one window per display, so a region can be selected on any
   * monitor. Only one kind is open at a time; opening one closes the other,
   * except that an active recording is never interrupted.
   */

  private openOverlays(page: AppPage) {
    const cursorDisplay = getCursorDisplay();
    const overlays = screen.getAllDisplays().map((display) => {
      const overlay = createOverlayWindow(page, display, {
        focus: display.id === cursorDisplay.id,
      });
      overlayDisplays.set(overlay.webContents.id, display);
      return overlay;
    });

    // Closing one overlay (Esc, Cancel) closes the whole set.
    for (const overlay of overlays) {
      const webContentsId = overlay.webContents.id;
      overlay.on("closed", () => {
        overlayDisplays.delete(webContentsId);
        this.handleOverlayClosed(overlay);
      });
    }
    return overlays;
  }

  private handleOverlayClosed(overlay: BrowserWindow) {
    if (this.recording?.overlay === overlay) {
      this.closeRecordingControls();
    }
    if (this.screenshotOverlays.includes(overlay)) this.closeScreenshotOverlays();
    if (this.videoOverlays.includes(overlay)) this.closeVideoOverlays();
  }

  private closeScreenshotOverlays() {
    const overlays = this.screenshotOverlays;
    this.screenshotOverlays = [];
    closeAll(overlays);
  }

  private closeVideoOverlays() {
    const overlays = this.videoOverlays;
    this.videoOverlays = [];
    this.closeRecordingControls();
    closeAll(overlays);
  }

  private closeRecordingControls() {
    const recording = this.recording;
    this.recording = null;
    if (recording && !recording.controls.isDestroyed()) {
      recording.controls.destroy();
    }
  }

  private focusOverlayUnderCursor(overlays: BrowserWindow[]) {
    const cursorDisplay = getCursorDisplay();
    const overlay =
      overlays.find((item) => overlayDisplays.get(item.webContents.id)?.id === cursorDisplay.id) ??
      overlays[0];
    overlay?.focus();
  }

  private showScreenshotOverlay() {
    if (this.recording || this.isCapturing) return;
    if (this.screenshotOverlays.length > 0) {
      this.focusOverlayUnderCursor(this.screenshotOverlays);
      return;
    }
    if (!ensureScreenCaptureAccess()) return;
    this.closeVideoOverlays();
    this.screenshotOverlays = this.openOverlays("screenshot-overlay.html");
  }

  private showVideoOverlay() {
    if (this.recording || this.isCapturing) return;
    if (this.videoOverlays.length > 0) {
      this.focusOverlayUnderCursor(this.videoOverlays);
      return;
    }
    if (!ensureScreenCaptureAccess()) return;
    this.closeScreenshotOverlays();
    this.videoOverlays = this.openOverlays("video-overlay.html");
  }

  /** Captures the whole display the mouse pointer is on. */
  private async captureFullScreen() {
    if (this.recording || this.isCapturing || !ensureScreenCaptureAccess()) return;
    // A full-screen capture replaces any region selection in progress.
    this.closeVideoOverlays();
    this.closeScreenshotOverlays();
    await this.captureScreenshot(getCursorDisplay(), null, null);
  }

  private applyTheme() {
    nativeTheme.themeSource = this.settings.appearance.theme;
  }

  // ---- Tray and shortcuts ------------------------------------------------

  private createTray() {
    this.tray = new Tray(this.createTrayIcon());
    this.tray.setToolTip("Fling");
    this.updateTrayMenu();
    if (process.platform !== "darwin") {
      this.tray.on("click", () => this.tray?.popUpContextMenu());
    }
  }

  private createTrayIcon() {
    if (process.platform === "darwin") {
      const icon = nativeImage.createFromPath(MAC_TRAY_ICON_PATH);
      icon.setTemplateImage(true);
      if (!icon.isEmpty()) return icon;
    }

    const sourceIcon = nativeImage.createFromPath(ICON_PATH);
    return sourceIcon.isEmpty()
      ? nativeImage.createEmpty()
      : sourceIcon.resize({ width: 20, height: 20 });
  }

  private updateTrayMenu() {
    if (!this.tray) return;

    const { signedIn, user } = this.session.state;
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open", click: () => this.showPage("index.html") },
        { label: "History", click: () => this.showPage("history.html") },
        signedIn
          ? {
              label: `Signed in as ${user?.name || user?.email || "Fling user"}`,
              submenu: [
                { label: "Sign out", click: () => void this.session.signOut() },
              ],
            }
          : { label: "Sign in", click: () => void this.signIn() },
        {
          label: "Capture Region",
          accelerator: this.settings.shortcuts.captureRegion ?? undefined,
          click: () => void this.showScreenshotOverlay(),
        },
        {
          label: "Capture Full Screen",
          accelerator: this.settings.shortcuts.captureFullscreen ?? undefined,
          click: () => void this.captureFullScreen(),
        },
        {
          label: "Record Region",
          accelerator: this.settings.shortcuts.recordVideo ?? undefined,
          click: () => void this.showVideoOverlay(),
        },
        { type: "separator" },
        { label: "Quit", click: () => app.exit(0) },
      ]),
    );
  }

  private registerGlobalShortcuts() {
    globalShortcut.unregisterAll();
    const { shortcuts } = this.settings;
    this.registerShortcut("capture region", shortcuts.captureRegion, () =>
      void this.showScreenshotOverlay(),
    );
    this.registerShortcut("capture full screen", shortcuts.captureFullscreen, () =>
      void this.captureFullScreen(),
    );
    this.registerShortcut("record video", shortcuts.recordVideo, () =>
      void this.showVideoOverlay(),
    );
  }

  private registerShortcut(
    label: string,
    accelerator: string | null,
    callback: () => void,
  ) {
    if (!accelerator) return;

    try {
      if (!globalShortcut.register(accelerator, callback)) {
        console.warn(`Could not register ${label} shortcut: ${accelerator}`);
      }
    } catch (error) {
      console.warn(`Invalid ${label} shortcut: ${accelerator}`, error);
    }
  }

  // ---- IPC: window and settings -----------------------------------------

  private registerWindowControls() {
    ipc.on("window:minimize", () => this.win?.minimize());
    ipc.on("window:toggle-maximize", () => {
      if (!this.win) return;
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    });
    ipc.on("window:close", () => this.win?.close());
  }

  private registerSettingsControls() {
    ipc.handle("settings:get", () => cloneSettings(this.settings));
    ipc.handle("settings:save", (_event, requested) =>
      this.updateSettings(normalizeSettings(requested)),
    );
    ipc.handle("settings:reset", () =>
      this.updateSettings(cloneSettings(DEFAULT_SETTINGS)),
    );
  }

  private async updateSettings(settings: FlingSettings) {
    this.settings = settings;
    this.applyTheme();
    await saveSettings(this.settings);
    this.registerGlobalShortcuts();
    this.updateTrayMenu();
    return cloneSettings(this.settings);
  }

  // ---- IPC: account ------------------------------------------------------

  private registerAuthControls() {
    ipc.handle("auth:get", async (_event, refresh) => {
      // If the server was down at startup, fill in the account name now.
      if (refresh !== false && this.session.state.signedIn && !this.session.state.user) {
        await this.session.refreshUser();
        this.updateTrayMenu();
      }
      return this.session.state;
    });
    ipc.handle("auth:sign-in", () => this.signIn());
    ipc.handle("auth:sign-out", () => this.session.signOut());
  }

  private signIn() {
    if (this.session.isSigningIn) {
      this.showMainWindow();
    }
    return this.session.signIn({
      onPending: (userCode) => this.showSignInProgress(userCode),
      onComplete: (user) => this.handleSignedIn(user),
      onError: (message) => this.win?.webContents.send("auth:error", { message }),
    });
  }

  private async showSignInProgress(userCode: string) {
    if (!this.win) return;
    if (!this.win.webContents.getURL().endsWith("/sign-in.html")) {
      await this.win.loadFile(pagePath("sign-in.html"));
    }
    this.showMainWindow();
    this.win.webContents.send("auth:pending", { userCode });
  }

  private handleSignedIn(user: DeviceUser) {
    this.win?.webContents.send("auth:complete", { user });
    const shouldOpenMainPage = this.win?.isVisible() ?? false;
    setTimeout(() => {
      if (
        shouldOpenMainPage &&
        this.win?.webContents.getURL().endsWith("/sign-in.html")
      ) {
        this.showPage("index.html");
      }
    }, SIGN_IN_SUCCESS_DELAY_MS);
  }

  // ---- IPC: history ------------------------------------------------------

  private registerHistoryControls() {
    ipc.handle("history:list", () => this.api.listCaptures());

    ipc.handle("history:copy-link", (_event, value) => {
      const url = toTrustedServerUrl(value, this.apiBaseUrl);
      if (!url) throw new Error("Invalid share URL");
      clipboard.writeText(url);
      return true;
    });

    ipc.handle("history:open-link", async (_event, value) => {
      const url = toTrustedServerUrl(value, this.apiBaseUrl);
      if (!url) throw new Error("Invalid share URL");
      await shell.openExternal(url);
      return true;
    });
  }

  // ---- Uploads -----------------------------------------------------------

  /** Uploads a capture and runs the "after capture" actions from settings. */
  private async uploadCapture(
    data: Buffer,
    title: string,
    mimeType: string,
    durationMs?: number,
  ) {
    const shareUrl = await this.api.uploadCapture(data, title, mimeType, durationMs);
    if (!shareUrl) return null;

    this.win?.webContents.send("history:changed");
    const { afterCapture } = this.settings;
    if (afterCapture.copyUrl) clipboard.writeText(shareUrl);
    if (afterCapture.openBrowser) await shell.openExternal(shareUrl);
    if (afterCapture.showNotification) {
      new Notification({ title: "Fling upload ready", body: shareUrl }).show();
    }
    return { shareUrl };
  }

  // ---- Screenshots -------------------------------------------------------

  private registerScreenshotControls() {
    ipc.on("screenshot-overlay:close", (event) => {
      const sender = getOverlaySender(event);
      if (sender && this.screenshotOverlays.includes(sender.window) && !this.isCapturing) {
        this.closeScreenshotOverlays();
      }
    });
    ipc.on("screenshot-overlay:screenshot", (event, rect, options) => {
      const sender = getOverlaySender(event);
      if (!sender || !this.screenshotOverlays.includes(sender.window)) return;
      const selection = parseRect(rect);
      if (!selection || selection.width <= 0 || selection.height <= 0) {
        sender.window.webContents.send("screenshot-overlay:error", "Select a region to capture");
        return;
      }
      void this.captureScreenshot(sender.display, selection, options, sender.window);
    });
  }

  /**
   * Captures `rect` on `display` (the whole display when rect is null).
   * `sourceOverlay` is the overlay the region was selected in, if any.
   */
  private async captureScreenshot(
    display: Electron.Display,
    rect: ReturnType<typeof parseRect>,
    requestedOptions: unknown,
    sourceOverlay?: BrowserWindow,
  ) {
    // Ignore repeated shortcut presses while a capture is still saving.
    if (this.isCapturing || this.recording) {
      sourceOverlay?.webContents.send("screenshot-overlay:error", "A capture is already in progress");
      return;
    }
    this.isCapturing = true;

    const overlays = this.screenshotOverlays.filter((item) => !item.isDestroyed());
    const options = normalizeScreenshotOptions(requestedOptions, this.settings);
    let image: Electron.NativeImage;

    try {
      // Give the overlays and tray menu time to disappear from the screen.
      overlays.forEach((item) => item.hide());
      await delay(OVERLAY_HIDE_DELAY_MS);

      image = await captureDisplay(display, rect);
      if (image.isEmpty()) throw new Error("The screen capture came back empty");
    } catch (error) {
      this.isCapturing = false;
      console.error("Could not capture screenshot:", error);
      const message = isPermissionError(error)
        ? "Screen Recording permission is needed"
        : "Could not capture the screen";
      const visibleOverlays = overlays.filter((item) => !item.isDestroyed());
      if (sourceOverlay && !sourceOverlay.isDestroyed()) {
        visibleOverlays.forEach(showWithoutFocus);
        sourceOverlay.show();
        sourceOverlay.webContents.send("screenshot-overlay:error", message);
      } else {
        this.notify("Screenshot failed", message);
      }
      if (isPermissionError(error)) void showScreenCaptureHelp().catch(console.error);
      return;
    }

    // The capture worked. Close the overlays right away so the user can keep
    // working while the file is saved and uploaded.
    this.closeScreenshotOverlays();

    try {
      const png = image.toPNG();
      const fileName = `Screenshot ${timestampForFileName()}.png`;

      if (options.copyToClipboard) clipboard.writeImage(image);

      if (options.saveLocally) {
        await this.writeCaptureFile("Fling Screenshots", fileName, png);
      }

      if (options.uploadToServer) {
        void this.uploadCapture(png, fileName, "image/png").catch((error) => {
          console.error("Could not upload screenshot", error);
          this.notify(
            "Upload failed",
            options.saveLocally
              ? `Saved locally, but the upload failed. ${describeUploadError(error)}`
              : describeUploadError(error),
          );
        });
      }
    } catch (error) {
      console.error("Could not save screenshot:", error);
      this.notify("Screenshot not saved", "Fling could not write the file.");
    } finally {
      this.isCapturing = false;
    }
  }

  /** Writes a capture to ~/Documents/<folder>, never overwriting a file. */
  private async writeCaptureFile(folderName: string, fileName: string, data: Buffer) {
    const folder = path.join(app.getPath("documents"), folderName);
    await fs.mkdir(folder, { recursive: true });

    const { name, ext } = path.parse(fileName);
    for (let attempt = 1; ; attempt += 1) {
      const candidate = path.join(
        folder,
        attempt === 1 ? fileName : `${name} (${attempt})${ext}`,
      );
      try {
        // "wx" fails if the file exists, so two captures in the same second
        // get "(2)" instead of replacing each other.
        await fs.writeFile(candidate, data, { flag: "wx" });
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  }

  private notify(title: string, body: string) {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  }

  // ---- Recordings --------------------------------------------------------

  private registerVideoControls() {
    ipc.on("video-overlay:close", (event) => {
      const sender = getOverlaySender(event);
      if (sender && this.videoOverlays.includes(sender.window)) this.closeVideoOverlays();
    });

    ipc.handle("video-overlay:start", async (event, value) => {
      const sender = getOverlaySender(event);
      if (!sender || !this.videoOverlays.includes(sender.window)) {
        throw new Error("Unknown recording overlay");
      }
      if (this.recording || this.isCapturing) throw new Error("A capture is already in progress");
      const requested = parseRect(value);
      if (!requested || requested.width <= 0 || requested.height <= 0) {
        throw new Error("Select a region to record");
      }
      const { bounds } = sender.display;
      const selection = clampScreenshotRect(requested, bounds);
      if (selection.width <= 0 || selection.height <= 0) {
        throw new Error("Select a region to record");
      }
      const otherWorkAreas = screen.getAllDisplays()
        .filter((display) => display.id !== sender.display.id)
        .map((display) => display.workArea);
      const controls = createRecordingControls(getRecordingControlsBounds(selection, bounds, otherWorkAreas));
      const recording: RecordingSession = { overlay: sender.window, controls, save: null };
      this.recording = recording;

      const otherOverlays = this.videoOverlays.filter((overlay) => overlay !== sender.window);
      this.videoOverlays = [sender.window];
      closeAll(otherOverlays);

      controls.on("closed", () => {
        if (this.recording === recording) this.closeVideoOverlays();
      });
      await controls.loadFile(pagePath("recording-controls.html"));
      if (this.recording !== recording) throw new Error("Recording was cancelled");
      showWithoutFocus(controls);
      setOverlayClickThrough(sender.window, true);

      return getScreenSourceId(sender.display);
    });

    ipc.handle("video-overlay:reset", (event) => {
      const sender = getOverlaySender(event);
      if (!sender || this.recording?.overlay !== sender.window) return;
      this.closeRecordingControls();
      setOverlayClickThrough(sender.window, false);
      sender.window.focus();
    });

    ipc.on("video-overlay:timer", (event, value) => {
      const recording = this.recording;
      if (!recording || event.sender !== recording.overlay.webContents) return;
      recording.controls.webContents.send("recording-controls:timer", value);
    });

    ipc.on("recording-controls:action", (event, action) => {
      const recording = this.recording;
      if (!recording || recording.save || event.sender !== recording.controls.webContents) return;
      if (typeof action === "string" && RECORDING_ACTIONS.includes(action)) {
        recording.overlay.webContents.send("video-overlay:action", action);
      }
    });

    ipc.handle("video-overlay:save", (event, data, durationMs) => {
      const recording = this.recording;
      if (!recording || event.sender !== recording.overlay.webContents) {
        throw new Error("Unknown recording session");
      }
      if (recording.save) return recording.save;
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : null;
      if (!bytes?.length) throw new Error("No recording data to save");
      recording.save = this.saveRecording(bytes, durationMs);
      return recording.save;
    });
  }

  private async saveRecording(data: Uint8Array, durationMs: unknown) {
    const fileName = `Recording ${timestampForFileName()}.webm`;
    const recording = Buffer.from(data);
    const savedPath = await this.writeCaptureFile("Fling Recordings", fileName, recording);

    // Use the length the recorder measured. Fall back to the time limit only
    // if the page did not send a usable value.
    const recordedDurationMs =
      isFiniteNumber(durationMs) && durationMs >= 0
        ? Math.round(durationMs)
        : this.settings.recording.durationSeconds * 1000;

    void this.uploadCapture(
      recording,
      fileName,
      "video/webm",
      recordedDurationMs,
    ).catch((error) => {
      console.error("Could not upload recording", error);
      this.notify(
        "Upload failed",
        `The recording was saved locally, but the upload failed. ${describeUploadError(error)}`,
      );
    });
    return savedPath;
  }
}
