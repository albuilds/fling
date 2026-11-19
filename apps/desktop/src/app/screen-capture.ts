// Captures images of a display. Works with any number of monitors on macOS
// and Windows: every function takes the display to capture.

import { desktopCapturer, screen } from "electron";
import { clampScreenshotRect } from "./geometry";
import type { Rect } from "./types";

/** The display the mouse pointer is on, used for full-screen captures. */
export function getCursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

async function getScreenSource(display: Electron.Display, thumbnailSize: Electron.Size) {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
  });
  if (sources.length === 0) throw new Error("Failed to get sources");

  const matched = sources.find((source) => source.display_id === String(display.id));
  if (matched) return matched;

  // Some platforms omit display IDs. Use position only for an unidentified source.
  const displays = screen.getAllDisplays();
  const index = displays.findIndex((item) => item.id === display.id);
  const fallback = sources[index];
  if (sources.length === displays.length && fallback?.display_id === "") return fallback;
  throw new Error("The selected display is no longer available");
}

/** Source ID the recording overlay needs to start a stream. */
export async function getScreenSourceId(display: Electron.Display) {
  const source = await getScreenSource(display, { width: 0, height: 0 });
  return source.id;
}

/**
 * Captures a display and crops it to `rect`, given in points relative to the
 * display's top-left corner (including the menu bar). The source image's
 * actual pixel dimensions determine the crop on scaled displays.
 */
export async function captureDisplay(display: Electron.Display, rect: Rect | null) {
  const scaleFactor = display.scaleFactor || 1;
  const { width, height } = display.bounds;
  const source = await getScreenSource(display, {
    width: Math.round(width * scaleFactor),
    height: Math.round(height * scaleFactor),
  });
  if (!rect || source.thumbnail.isEmpty()) return source.thumbnail;

  const area = clampScreenshotRect(rect, display.bounds);
  const size = source.thumbnail.getSize();
  const scaleX = size.width / width;
  const scaleY = size.height / height;
  const x = Math.round(area.left * scaleX);
  const y = Math.round(area.top * scaleY);

  return source.thumbnail.crop({
    x,
    y,
    width: Math.round((area.left + area.width) * scaleX) - x,
    height: Math.round((area.top + area.height) * scaleY) - y,
  });
}
