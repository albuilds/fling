// main.ts — Electron main process entry point.
// Manages the BrowserWindow and system tray for the Fling desktop app.
// The window hides instead of closing so the app stays alive in the tray.

console.log("Start app!");

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  globalShortcut,
  screen,
  desktopCapturer,
  clipboard,
  session,
} from "electron";
import fs from "fs/promises";
import path from "path";

type ScreenshotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ScreenshotOptions = {
  copyToClipboard: boolean;
  saveLocally: boolean;
  uploadToServer: boolean;
};

type ShortcutId = "captureRegion" | "captureFullscreen" | "recordVideo";

type ShortcutSettings = Record<ShortcutId, string | null>;

type FlingSettings = {
  afterCapture: {
    openBrowser: boolean;
    copyUrl: boolean;
    showNotification: boolean;
  };
  screenshot: {
    copyToClipboard: boolean;
    saveLocally: boolean;
    uploadToServer: boolean;
  };
  recording: {
    saveLocally: boolean;
    durationSeconds: number;
    fps: number;
    quality: "low" | "medium" | "high";
    includeSystemAudio: boolean;
    includeMicrophone: boolean;
    microphoneId: string;
  };
  shortcuts: ShortcutSettings;
};

type ScreenSourceInfo = {
  id: string;
  width: number;
  height: number;
};

type VideoRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type VideoRecordingRegion = {
  selection: VideoRect;
  timer: VideoRect;
};

const DEFAULT_SETTINGS: FlingSettings = {
  afterCapture: {
    openBrowser: true,
    copyUrl: true,
    showNotification: true,
  },
  screenshot: {
    copyToClipboard: false,
    saveLocally: true,
    uploadToServer: false,
  },
  recording: {
    saveLocally: true,
    durationSeconds: 10,
    fps: 30,
    quality: "medium",
    includeSystemAudio: false,
    includeMicrophone: false,
    microphoneId: "",
  },
  shortcuts: {
    captureRegion: "CommandOrControl+Shift+S",
    captureFullscreen: "CommandOrControl+Shift+F",
    recordVideo: "CommandOrControl+Shift+R",
  },
};

class FlingApp {
  private tray: Tray | null = null;
  private win: BrowserWindow | null = null;
  private screenshotOverlay: BrowserWindow | null = null;
  private videoOverlay: BrowserWindow | null = null;
  private settings: FlingSettings = this.cloneSettings(DEFAULT_SETTINGS);

  private createWindow() {
    this.win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      skipTaskbar: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });
    this.win.loadFile(path.join(__dirname, "../src/index.html"));
    this.win.on("close", (e) => {
      e.preventDefault();
      this.win?.hide();
    });
  }

  private showPage(fileName: string) {
    this.win?.loadFile(path.join(__dirname, `../src/${fileName}`));
    this.win?.show();
    this.win?.focus();
  }

  private showScreenshotOverlay() {
    if (this.screenshotOverlay) {
      this.screenshotOverlay.focus();
      return;
    }

    const { bounds } = screen.getPrimaryDisplay();
    this.screenshotOverlay = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    this.screenshotOverlay.setAlwaysOnTop(true, "screen-saver");
    this.screenshotOverlay.loadFile(
      path.join(__dirname, "../src/screenshot-overlay.html"),
    );
    this.screenshotOverlay.once("ready-to-show", () =>
      this.screenshotOverlay?.show(),
    );
    this.screenshotOverlay.on("closed", () => {
      this.screenshotOverlay = null;
    });
  }

  private showVideoOverlay() {
    if (this.videoOverlay) {
      this.videoOverlay.focus();
      return;
    }

    const { bounds } = screen.getPrimaryDisplay();
    this.videoOverlay = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    this.videoOverlay.setAlwaysOnTop(true, "screen-saver");
    this.videoOverlay.loadFile(
      path.join(__dirname, "../src/video-overlay.html"),
    );
    this.videoOverlay.once("ready-to-show", () => this.videoOverlay?.show());
    this.videoOverlay.on("closed", () => {
      this.videoOverlay = null;
    });
  }

  private createTray() {
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip("Fling");
    this.updateTrayMenu();
    this.tray.on("click", () => {
      this.tray?.popUpContextMenu();
    });
  }

  private updateTrayMenu() {
    if (!this.tray) return;

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open", click: () => this.showPage("index.html") },
        { label: "History", click: () => this.showPage("history.html") },
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
        {
          label: "Quit",
          click: () => {
            app.exit(0);
          },
        },
      ]),
    );
  }

  async start() {
    app.setAppUserModelId("fling");
    Menu.setApplicationMenu(null);
    await this.loadSettings();
    this.registerMediaPermissions();
    this.registerWindowControls();
    this.registerSettingsControls();
    this.registerScreenshotControls();
    this.registerVideoControls();
    this.createWindow();
    this.createTray();
    this.registerGlobalShortcuts();
  }

  private registerMediaPermissions() {
    session.defaultSession.setPermissionCheckHandler(
      (webContents, permission) => {
        return (
          permission === "media" && this.isTrustedAppWebContents(webContents)
        );
      },
    );

    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        callback(
          (permission === "media" || permission === "display-capture") &&
            this.isTrustedAppWebContents(webContents),
        );
      },
    );
  }

  private isTrustedAppWebContents(webContents: Electron.WebContents | null) {
    const url = webContents?.getURL() ?? "";
    return url.startsWith("file://");
  }

  private registerWindowControls() {
    ipcMain.on("window:minimize", () => this.win?.minimize());
    ipcMain.on("window:toggle-maximize", () => {
      if (!this.win) return;
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    });
    ipcMain.on("window:close", () => this.win?.close());
  }

  private registerSettingsControls() {
    ipcMain.handle("settings:get", () => this.cloneSettings(this.settings));
    ipcMain.handle("settings:save", async (_event, requestedSettings) => {
      this.settings = this.normalizeSettings(requestedSettings);
      await this.saveSettings();
      this.registerGlobalShortcuts();
      this.updateTrayMenu();
      return this.cloneSettings(this.settings);
    });
    ipcMain.handle("settings:reset", async () => {
      this.settings = this.cloneSettings(DEFAULT_SETTINGS);
      await this.saveSettings();
      this.registerGlobalShortcuts();
      this.updateTrayMenu();
      return this.cloneSettings(this.settings);
    });
  }

  private registerScreenshotControls() {
    ipcMain.on("screenshot-overlay:close", () =>
      this.screenshotOverlay?.close(),
    );
    ipcMain.on(
      "screenshot-overlay:screenshot",
      async (
        _event,
        rect: ScreenshotRect | null,
        options: Partial<ScreenshotOptions> | null,
      ) => {
        await this.captureScreenshot(rect, options);
      },
    );
  }

  private registerVideoControls() {
    ipcMain.on("video-overlay:close", () => this.videoOverlay?.close());
    ipcMain.handle("video-overlay:set-ignore-mouse-events", (_event, ignore) => {
      if (!this.videoOverlay) return;

      const shouldIgnoreMouse = ignore === true;
      this.setVideoOverlayInputPassthrough(shouldIgnoreMouse);
    });
    ipcMain.handle(
      "video-overlay:set-recording-region",
      (_event, region: VideoRect | VideoRecordingRegion | null) => {
        this.setVideoOverlayRecordingRegion(region);
      },
    );
    ipcMain.handle("video-overlay:get-source", async () => {
      return this.getPrimaryScreenSourceInfo();
    });
    ipcMain.handle("video-overlay:save", async (_event, data: ArrayBuffer) => {
      const folder = path.join(app.getPath("documents"), "Fling Recordings");
      await fs.mkdir(folder, { recursive: true });

      const savedPath = path.join(
        folder,
        `fling-recording-${this.timestampForFileName()}.webm`,
      );
      await fs.writeFile(savedPath, Buffer.from(new Uint8Array(data)));
      return savedPath;
    });
  }

  private async captureScreenshot(
    rect: ScreenshotRect | null,
    requestedOptions: Partial<ScreenshotOptions> | null,
  ) {
    const overlay = this.screenshotOverlay;
    const options = this.normalizeScreenshotOptions(requestedOptions);

    try {
      if (overlay) {
        overlay.webContents.send("screenshot-overlay:pending");
        overlay.hide();
        await new Promise((resolve) => setTimeout(resolve, 160));
      }

      const display = screen.getPrimaryDisplay();
      const scaleFactor = display.scaleFactor || 1;
      const captureArea = this.normalizeScreenshotRect(rect, display.bounds);
      const source = await this.getPrimaryScreenSource(
        display.id,
        display.bounds,
        scaleFactor,
      );
      const image = source.thumbnail.crop({
        x: Math.round(captureArea.left * scaleFactor),
        y: Math.round(captureArea.top * scaleFactor),
        width: Math.round(captureArea.width * scaleFactor),
        height: Math.round(captureArea.height * scaleFactor),
      });

      let savedPath = "";

      if (options.copyToClipboard) {
        this.writeScreenshotToClipboard(image);
      }

      if (options.saveLocally) {
        const folder = path.join(app.getPath("documents"), "Fling Screenshots");
        await fs.mkdir(folder, { recursive: true });

        savedPath = path.join(
          folder,
          `fling-screenshot-${this.timestampForFileName()}.png`,
        );
        await fs.writeFile(savedPath, image.toPNG());
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

  private normalizeScreenshotOptions(
    options: Partial<ScreenshotOptions> | null,
  ): ScreenshotOptions {
    return {
      copyToClipboard:
        options?.copyToClipboard ?? this.settings.screenshot.copyToClipboard,
      saveLocally: options?.saveLocally ?? this.settings.screenshot.saveLocally,
      uploadToServer: options?.uploadToServer === true,
    };
  }

  private async loadSettings() {
    try {
      const settingsJson = await fs.readFile(this.getSettingsPath(), "utf8");
      this.settings = this.normalizeSettings(JSON.parse(settingsJson));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn("Could not load settings. Using defaults.", error);
      }
      this.settings = this.cloneSettings(DEFAULT_SETTINGS);
    }
  }

  private async saveSettings() {
    const settingsPath = this.getSettingsPath();
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(
      settingsPath,
      `${JSON.stringify(this.settings, null, 2)}\n`,
      "utf8",
    );
  }

  private getSettingsPath() {
    return path.join(app.getPath("userData"), "settings.json");
  }

  private registerGlobalShortcuts() {
    globalShortcut.unregisterAll();
    this.registerGlobalShortcut(
      "capture region",
      this.settings.shortcuts.captureRegion,
      () => this.showScreenshotOverlay(),
    );
    this.registerGlobalShortcut(
      "capture full screen",
      this.settings.shortcuts.captureFullscreen,
      () => this.captureScreenshot(null, null),
    );
    this.registerGlobalShortcut(
      "record video",
      this.settings.shortcuts.recordVideo,
      () => this.showVideoOverlay(),
    );
  }

  private registerGlobalShortcut(
    label: string,
    accelerator: string | null,
    callback: () => void,
  ) {
    if (!accelerator) return;

    try {
      const registered = globalShortcut.register(accelerator, callback);
      if (!registered) {
        console.warn(`Could not register ${label} shortcut: ${accelerator}`);
      }
    } catch (error) {
      console.warn(`Invalid ${label} shortcut: ${accelerator}`, error);
    }
  }

  private normalizeSettings(settings: unknown): FlingSettings {
    const requested = this.asRecord(settings);
    const afterCapture = this.asRecord(requested.afterCapture);
    const screenshot = this.asRecord(requested.screenshot);
    const recording = this.asRecord(requested.recording);
    const shortcuts = this.asRecord(requested.shortcuts);

    return {
      afterCapture: {
        openBrowser: this.booleanOrDefault(
          afterCapture.openBrowser,
          DEFAULT_SETTINGS.afterCapture.openBrowser,
        ),
        copyUrl: this.booleanOrDefault(
          afterCapture.copyUrl,
          DEFAULT_SETTINGS.afterCapture.copyUrl,
        ),
        showNotification: this.booleanOrDefault(
          afterCapture.showNotification,
          DEFAULT_SETTINGS.afterCapture.showNotification,
        ),
      },
      screenshot: {
        copyToClipboard: this.booleanOrDefault(
          screenshot.copyToClipboard,
          DEFAULT_SETTINGS.screenshot.copyToClipboard,
        ),
        saveLocally: this.booleanOrDefault(
          screenshot.saveLocally,
          DEFAULT_SETTINGS.screenshot.saveLocally,
        ),
        uploadToServer: false,
      },
      recording: {
        saveLocally: this.booleanOrDefault(
          recording.saveLocally,
          DEFAULT_SETTINGS.recording.saveLocally,
        ),
        durationSeconds: this.oneOf(
          recording.durationSeconds,
          [5, 10, 15, 20, 30],
          DEFAULT_SETTINGS.recording.durationSeconds,
        ),
        fps: this.oneOf(recording.fps, [15, 30, 60], DEFAULT_SETTINGS.recording.fps),
        quality: this.oneOf(
          recording.quality,
          ["low", "medium", "high"],
          DEFAULT_SETTINGS.recording.quality,
        ),
        includeSystemAudio: this.booleanOrDefault(
          recording.includeSystemAudio,
          DEFAULT_SETTINGS.recording.includeSystemAudio,
        ),
        includeMicrophone: this.booleanOrDefault(
          recording.includeMicrophone,
          DEFAULT_SETTINGS.recording.includeMicrophone,
        ),
        microphoneId:
          typeof recording.microphoneId === "string"
            ? recording.microphoneId
            : DEFAULT_SETTINGS.recording.microphoneId,
      },
      shortcuts: {
        captureRegion: this.shortcutOrDefault(
          shortcuts.captureRegion,
          DEFAULT_SETTINGS.shortcuts.captureRegion,
        ),
        captureFullscreen: this.shortcutOrDefault(
          shortcuts.captureFullscreen,
          DEFAULT_SETTINGS.shortcuts.captureFullscreen,
        ),
        recordVideo: this.shortcutOrDefault(
          shortcuts.recordVideo,
          DEFAULT_SETTINGS.shortcuts.recordVideo,
        ),
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private booleanOrDefault(value: unknown, defaultValue: boolean) {
    return typeof value === "boolean" ? value : defaultValue;
  }

  private oneOf<T extends string | number>(
    value: unknown,
    allowed: readonly T[],
    defaultValue: T,
  ): T {
    return allowed.includes(value as T) ? (value as T) : defaultValue;
  }

  private shortcutOrDefault(value: unknown, defaultValue: string | null) {
    if (value === null) return null;
    if (typeof value !== "string") return defaultValue;

    const shortcut = value.trim();
    return shortcut ? shortcut : null;
  }

  private cloneSettings(settings: FlingSettings): FlingSettings {
    return JSON.parse(JSON.stringify(settings)) as FlingSettings;
  }

  private writeScreenshotToClipboard(image: Electron.NativeImage) {
    if (image.isEmpty()) {
      throw new Error("Cannot copy empty screenshot image");
    }

    clipboard.writeImage(image);
  }

  private async getPrimaryScreenSource(
    displayId: number,
    bounds: Electron.Rectangle,
    scaleFactor: number,
  ) {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(bounds.width * scaleFactor),
        height: Math.round(bounds.height * scaleFactor),
      },
    });

    return (
      sources.find((source) => source.display_id === String(displayId)) ??
      sources[0]
    );
  }

  private async getPrimaryScreenSourceInfo(): Promise<ScreenSourceInfo> {
    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor || 1;
    const source = await this.getPrimaryScreenSource(
      display.id,
      display.bounds,
      scaleFactor,
    );

    return {
      id: source.id,
      width: Math.round(display.bounds.width * scaleFactor),
      height: Math.round(display.bounds.height * scaleFactor),
    };
  }

  private setVideoOverlayRecordingRegion(
    region: VideoRect | VideoRecordingRegion | null,
  ) {
    if (!this.videoOverlay) return;

    const bounds = this.videoOverlay.getBounds();
    if (!region) {
      this.videoOverlay.setShape([
        { x: 0, y: 0, width: bounds.width, height: bounds.height },
      ]);
      return;
    }

    const selection = this.isVideoRecordingRegion(region)
      ? region.selection
      : region;
    const timer = this.isVideoRecordingRegion(region)
      ? region.timer
      : this.getDefaultVideoTimerRect(bounds);
    const border = 4;
    const left = Math.round(selection.left);
    const top = Math.round(selection.top);
    const width = Math.round(selection.width);
    const height = Math.round(selection.height);
    const shape = [
      { left, top, width, height: border },
      { left, top: top + height - border, width, height: border },
      { left, top, width: border, height },
      { left: left + width - border, top, width: border, height },
      timer,
    ]
      .map((rect) => this.toVideoOverlayShapeRect(rect, bounds))
      .filter((rect): rect is Electron.Rectangle => rect !== null);

    this.videoOverlay.setShape(shape);
  }

  private isVideoRecordingRegion(
    region: VideoRect | VideoRecordingRegion,
  ): region is VideoRecordingRegion {
    return "selection" in region && "timer" in region;
  }

  private getDefaultVideoTimerRect(bounds: Electron.Rectangle): VideoRect {
    const timerWidth = 132;
    const timerHeight = 58;

    return {
      left: Math.round((bounds.width - timerWidth) / 2),
      top: bounds.height - timerHeight - 12,
      width: timerWidth,
      height: timerHeight,
    };
  }

  private toVideoOverlayShapeRect(
    rect: VideoRect,
    bounds: Electron.Rectangle,
  ): Electron.Rectangle | null {
    const x = Math.max(0, Math.min(Math.round(rect.left), bounds.width));
    const y = Math.max(0, Math.min(Math.round(rect.top), bounds.height));
    const right = Math.max(
      x,
      Math.min(Math.round(rect.left + rect.width), bounds.width),
    );
    const bottom = Math.max(
      y,
      Math.min(Math.round(rect.top + rect.height), bounds.height),
    );
    const width = right - x;
    const height = bottom - y;

    if (width <= 0 || height <= 0) return null;

    return { x, y, width, height };
  }

  private setVideoOverlayInputPassthrough(enabled: boolean) {
    if (!this.videoOverlay) return;

    if (enabled) {
      this.videoOverlay.setIgnoreMouseEvents(false);
      this.videoOverlay.setFocusable(false);
      this.videoOverlay.blur();
      return;
    }

    this.videoOverlay.setFocusable(true);
    this.videoOverlay.setIgnoreMouseEvents(false);
  }

  private normalizeScreenshotRect(
    rect: ScreenshotRect | null,
    bounds: Electron.Rectangle,
  ): ScreenshotRect {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { left: 0, top: 0, width: bounds.width, height: bounds.height };
    }

    const left = Math.max(0, Math.min(rect.left, bounds.width));
    const top = Math.max(0, Math.min(rect.top, bounds.height));
    const right = Math.max(
      left,
      Math.min(rect.left + rect.width, bounds.width),
    );
    const bottom = Math.max(
      top,
      Math.min(rect.top + rect.height, bounds.height),
    );

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  private timestampForFileName() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
}

// Waits for Electron to finish initializing and creates the Fling applicaiton.
app.whenReady().then(() => {
  new FlingApp().start().catch((error) => {
    console.error("Could not start Fling:", error);
    app.exit(1);
  });
});

// Removes shortcuts before full shutdown.
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
