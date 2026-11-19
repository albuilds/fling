// Shared types for the Electron main process.

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** A recording area plus the on-screen timer that must stay clickable. */
export type RecordingRegion = {
  selection: Rect;
  timer: Rect;
};

export type ScreenshotOptions = {
  copyToClipboard: boolean;
  saveLocally: boolean;
  uploadToServer: boolean;
};

export type ShortcutId = "captureRegion" | "captureFullscreen" | "recordVideo";

export type ShortcutSettings = Record<ShortcutId, string | null>;

export type FlingSettings = {
  appearance: {
    theme: "system" | "dark" | "light";
  };
  afterCapture: {
    openBrowser: boolean;
    copyUrl: boolean;
    showNotification: boolean;
  };
  screenshot: ScreenshotOptions;
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

export type ScreenSourceInfo = {
  id: string;
  width: number;
  height: number;
};

export type DeviceUser = {
  name: string | null;
  email: string | null;
};

export type AuthState = {
  signedIn: boolean;
  user: DeviceUser | null;
};
