// Loads, validates, and saves the user's settings file.

import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import type { FlingSettings, ScreenshotOptions } from "./types";
import { asRecord, booleanOr, oneOf } from "./validation";

export const DEFAULT_SETTINGS: FlingSettings = {
  appearance: {
    theme: "system",
  },
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

export function cloneSettings(settings: FlingSettings): FlingSettings {
  return JSON.parse(JSON.stringify(settings)) as FlingSettings;
}

/** A shortcut may be cleared with null or an empty string. */
function shortcutOr(value: unknown, fallback: string | null) {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;

  const shortcut = value.trim();
  return shortcut ? shortcut : null;
}

/**
 * Builds a complete, valid settings object from untrusted input (the
 * settings file or the settings page). Anything missing or invalid falls
 * back to the default.
 */
export function normalizeSettings(input: unknown): FlingSettings {
  const requested = asRecord(input);
  const appearance = asRecord(requested.appearance);
  const afterCapture = asRecord(requested.afterCapture);
  const screenshot = asRecord(requested.screenshot);
  const recording = asRecord(requested.recording);
  const shortcuts = asRecord(requested.shortcuts);
  const defaults = DEFAULT_SETTINGS;

  return {
    appearance: {
      theme: oneOf(
        appearance.theme,
        ["system", "dark", "light"],
        defaults.appearance.theme,
      ),
    },
    afterCapture: {
      openBrowser: booleanOr(
        afterCapture.openBrowser,
        defaults.afterCapture.openBrowser,
      ),
      copyUrl: booleanOr(afterCapture.copyUrl, defaults.afterCapture.copyUrl),
      showNotification: booleanOr(
        afterCapture.showNotification,
        defaults.afterCapture.showNotification,
      ),
    },
    screenshot: {
      copyToClipboard: booleanOr(
        screenshot.copyToClipboard,
        defaults.screenshot.copyToClipboard,
      ),
      saveLocally: booleanOr(
        screenshot.saveLocally,
        defaults.screenshot.saveLocally,
      ),
      uploadToServer: booleanOr(
        screenshot.uploadToServer,
        defaults.screenshot.uploadToServer,
      ),
    },
    recording: {
      saveLocally: booleanOr(
        recording.saveLocally,
        defaults.recording.saveLocally,
      ),
      durationSeconds: oneOf(
        recording.durationSeconds,
        [5, 10, 15, 20, 30],
        defaults.recording.durationSeconds,
      ),
      fps: oneOf(recording.fps, [15, 30, 60], defaults.recording.fps),
      quality: oneOf(
        recording.quality,
        ["low", "medium", "high"],
        defaults.recording.quality,
      ),
      includeSystemAudio: booleanOr(
        recording.includeSystemAudio,
        defaults.recording.includeSystemAudio,
      ),
      includeMicrophone: booleanOr(
        recording.includeMicrophone,
        defaults.recording.includeMicrophone,
      ),
      microphoneId:
        typeof recording.microphoneId === "string"
          ? recording.microphoneId
          : defaults.recording.microphoneId,
    },
    shortcuts: {
      captureRegion: shortcutOr(
        shortcuts.captureRegion,
        defaults.shortcuts.captureRegion,
      ),
      captureFullscreen: shortcutOr(
        shortcuts.captureFullscreen,
        defaults.shortcuts.captureFullscreen,
      ),
      recordVideo: shortcutOr(
        shortcuts.recordVideo,
        defaults.shortcuts.recordVideo,
      ),
    },
  };
}

/**
 * Screenshot options chosen in the overlay for one capture. Saving and
 * copying fall back to the saved settings; uploading must be opted into.
 */
export function normalizeScreenshotOptions(
  input: unknown,
  settings: FlingSettings,
): ScreenshotOptions {
  const requested = asRecord(input);
  return {
    copyToClipboard: booleanOr(
      requested.copyToClipboard,
      settings.screenshot.copyToClipboard,
    ),
    saveLocally: booleanOr(
      requested.saveLocally,
      settings.screenshot.saveLocally,
    ),
    uploadToServer: requested.uploadToServer === true,
  };
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<FlingSettings> {
  try {
    const settingsJson = await fs.readFile(getSettingsPath(), "utf8");
    return normalizeSettings(JSON.parse(settingsJson));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("Could not load settings. Using defaults.", error);
    }
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: FlingSettings) {
  const settingsPath = getSettingsPath();
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
}
