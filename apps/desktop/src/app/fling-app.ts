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
  Notification,
  shell,
  Tray,
} from "electron";
import fs from "fs/promises";
import path from "path";
import { DeviceSession } from "./device-session";
import { FlingApi } from "./fling-api";
import { buildRecordingShape, parseRecordingRegion, parseRect } from "./geometry";
import * as ipc from "./ipc";
import { ICON_PATH, pagePath } from "./paths";
import type { AppPage } from "./paths";
import { capturePrimaryDisplay, getPrimaryScreenSourceInfo } from "./screen-capture";
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
  registerMediaPermissions,
  setOverlayClickThrough,
} from "./windows";

/** Delay so the overlay is fully hidden before the screen is captured. */
const OVERLAY_HIDE_DELAY_MS = 160;
/** How long the "Signed in" screen stays up before the main page opens. */
const SIGN_IN_SUCCESS_DELAY_MS = 1400;

function timestampForFileName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  private screenshotOverlay: BrowserWindow | null = null;
  private videoOverlay: BrowserWindow | null = null;

  async start() {
    app.setAppUserModelId("fling");
    if (process.platform === "darwin") {
      const dockIcon = nativeImage.createFromPath(ICON_PATH);
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
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

    this.win = createMainWindow();
    this.createTray();
    this.registerGlobalShortcuts();
    if (!this.session.state.signedIn) this.showPage("sign-in.html");
  }

  // ---- Windows -----------------------------------------------------------

  private showPage(page: AppPage) {
    this.win?.loadFile(pagePath(page));
    this.win?.show();
    this.win?.focus();
  }

  private showScreenshotOverlay() {
    if (this.screenshotOverlay) {
      this.screenshotOverlay.focus();
      return;
    }
    this.screenshotOverlay = createOverlayWindow("screenshot-overlay.html");
    this.screenshotOverlay.on("closed", () => {
      this.screenshotOverlay = null;
    });
  }

  private showVideoOverlay() {
    if (this.videoOverlay) {
      this.videoOverlay.focus();
      return;
    }
    this.videoOverlay = createOverlayWindow("video-overlay.html");
    this.videoOverlay.on("closed", () => {
      this.videoOverlay = null;
    });
  }

  private applyTheme() {
    nativeTheme.themeSource = this.settings.appearance.theme;
  }

  // ---- Tray and shortcuts ------------------------------------------------

  private createTray() {
    const sourceIcon = nativeImage.createFromPath(ICON_PATH);
    const size = process.platform === "darwin" ? 18 : 20;
    const icon = sourceIcon.isEmpty()
      ? nativeImage.createEmpty()
      : sourceIcon.resize({ width: size, height: size });
    this.tray = new Tray(icon);
    this.tray.setToolTip("Fling");
    this.updateTrayMenu();
    this.tray.on("click", () => {
      this.tray?.popUpContextMenu();
    });
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
          click: () => this.showScreenshotOverlay(),
        },
        {
          label: "Capture Full Screen",
          accelerator: this.settings.shortcuts.captureFullscreen ?? undefined,
          click: () => this.captureScreenshot(null, null),
        },
        {
          label: "Record Region",
          accelerator: this.settings.shortcuts.recordVideo ?? undefined,
          click: () => this.showVideoOverlay(),
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
      this.showScreenshotOverlay(),
    );
    this.registerShortcut("capture full screen", shortcuts.captureFullscreen, () =>
      this.captureScreenshot(null, null),
    );
    this.registerShortcut("record video", shortcuts.recordVideo, () =>
      this.showVideoOverlay(),
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
    ipc.handle("auth:get", () => this.session.state);
    ipc.handle("auth:sign-in", () => this.signIn());
    ipc.handle("auth:sign-out", () => this.session.signOut());
  }

  private signIn() {
    if (this.session.isSigningIn) {
      this.win?.show();
      this.win?.focus();
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
    this.win.show();
    this.win.focus();
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
    ipc.on("screenshot-overlay:close", () => this.screenshotOverlay?.close());
    ipc.on("screenshot-overlay:screenshot", (_event, rect, options) => {
      void this.captureScreenshot(parseRect(rect), options);
    });
  }

  private async captureScreenshot(
    rect: ReturnType<typeof parseRect>,
    requestedOptions: unknown,
  ) {
    const overlay = this.screenshotOverlay;
    const options = normalizeScreenshotOptions(requestedOptions, this.settings);

    try {
      if (overlay) {
        overlay.webContents.send("screenshot-overlay:pending");
        overlay.hide();
        await delay(OVERLAY_HIDE_DELAY_MS);
      }

      const image = await capturePrimaryDisplay(rect);
      const png = image.toPNG();
      const fileName = `fling-screenshot-${timestampForFileName()}.png`;
      let savedPath = "";

      if (options.copyToClipboard) {
        if (image.isEmpty()) throw new Error("Cannot copy empty screenshot image");
        clipboard.writeImage(image);
      }

      if (options.saveLocally) {
        const folder = path.join(app.getPath("documents"), "Fling Screenshots");
        await fs.mkdir(folder, { recursive: true });
        savedPath = path.join(folder, fileName);
        await fs.writeFile(savedPath, png);
      }

      if (options.uploadToServer) {
        await this.uploadCapture(png, fileName, "image/png");
      }

      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send("screenshot-overlay:saved", savedPath);
        overlay.close();
      }
    } catch (error) {
      console.error("Could not capture screenshot:", error);
      if (overlay && !overlay.isDestroyed()) {
        overlay.show();
        overlay.webContents.send("screenshot-overlay:error");
      }
    }
  }

  // ---- Recordings --------------------------------------------------------

  private registerVideoControls() {
    ipc.on("video-overlay:close", () => this.videoOverlay?.close());

    ipc.handle("video-overlay:set-ignore-mouse-events", (_event, ignore) => {
      if (this.videoOverlay) setOverlayClickThrough(this.videoOverlay, ignore === true);
    });

    ipc.handle("video-overlay:set-recording-region", (_event, region) => {
      if (!this.videoOverlay) return;
      const shape = buildRecordingShape(
        parseRecordingRegion(region),
        this.videoOverlay.getBounds(),
      );
      this.videoOverlay.setShape(shape);
    });

    ipc.handle("video-overlay:get-source", () => getPrimaryScreenSourceInfo());

    ipc.handle("video-overlay:save", (_event, data, durationMs) => {
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : null;
      if (!bytes) throw new Error("Recording data must be binary");
      return this.saveRecording(bytes, durationMs);
    });
  }

  private async saveRecording(data: Uint8Array, durationMs: unknown) {
    const folder = path.join(app.getPath("documents"), "Fling Recordings");
    await fs.mkdir(folder, { recursive: true });

    const fileName = `fling-recording-${timestampForFileName()}.webm`;
    const savedPath = path.join(folder, fileName);
    const recording = Buffer.from(data);
    await fs.writeFile(savedPath, recording);

    // Use the length the recorder measured. Fall back to the time limit only
    // if the page did not send a usable value.
    const maxDurationMs = this.settings.recording.durationSeconds * 1000;
    const recordedDurationMs =
      isFiniteNumber(durationMs) && durationMs >= 0
        ? Math.min(Math.round(durationMs), maxDurationMs)
        : maxDurationMs;

    await this.uploadCapture(
      recording,
      fileName,
      "video/webm",
      recordedDurationMs,
    ).catch((error) => console.error("Could not upload recording", error));
    return savedPath;
  }
}
