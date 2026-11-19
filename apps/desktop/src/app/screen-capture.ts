// Captures images of a display. Works with any number of monitors on macOS
// and Windows: every function takes the display to capture.

import { desktopCapturer, screen } from "electron";
import { clampScreenshotRect } from "./geometry";
import type { Rect, ScreenSourceInfo } from "./types";

/** The display the mouse pointer is on, used for full-screen captures. */
export function getCursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

/** Finds the capture source for a display, sized to its full resolution. */
async function getScreenSource(display: Electron.Display) {
  const scaleFactor = display.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.bounds.width * scaleFactor),
      height: Math.round(display.bounds.height * scaleFactor),
    },
  });
  if (sources.length === 0) throw new Error("Failed to get sources");

  // display_id links a source to its display. It can be empty on some
  // systems, so fall back to the same position in the display list.
  const index = screen.getAllDisplays().findIndex((item) => item.id === display.id);
  return (
    sources.find((source) => source.display_id === String(display.id)) ??
    sources[index] ??
    sources[0]
  );
}

/** Source ID and pixel size the recording overlay needs to start a stream. */
export async function getScreenSourceInfo(
  display: Electron.Display,
): Promise<ScreenSourceInfo> {
  const scaleFactor = display.scaleFactor || 1;
  const source = await getScreenSource(display);

  return {
    id: source.id,
    width: Math.round(display.bounds.width * scaleFactor),
    height: Math.round(display.bounds.height * scaleFactor),
  };
}

/**
 * Captures a display and crops it to `rect`, given in points relative to the
 * display's top-left corner (including the menu bar). Points are multiplied
 * by the scale factor because a Retina display has more pixels than points.
 */
export async function captureDisplay(display: Electron.Display, rect: Rect | null) {
  const scaleFactor = display.scaleFactor || 1;
  const area = clampScreenshotRect(rect, {
    x: 0,
    y: 0,
    width: display.bounds.width,
    height: display.bounds.height,
  });
  const source = await getScreenSource(display);

  return source.thumbnail.crop({
    x: Math.round(area.left * scaleFactor),
    y: Math.round(area.top * scaleFactor),
    width: Math.round(area.width * scaleFactor),
    height: Math.round(area.height * scaleFactor),
  });
}
