// Captures images of the primary display.

import { desktopCapturer, screen } from "electron";
import { clampScreenshotRect } from "./geometry";
import type { Rect, ScreenSourceInfo } from "./types";

async function getPrimaryScreenSource(
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

/** Source ID and pixel size the recording overlay needs to start a stream. */
export async function getPrimaryScreenSourceInfo(): Promise<ScreenSourceInfo> {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor || 1;
  const source = await getPrimaryScreenSource(
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

/**
 * Captures the primary display and crops it to `rect` (in screen points).
 * Points are multiplied by the scale factor because a Retina display has
 * more pixels than points.
 */
export async function capturePrimaryDisplay(rect: Rect | null) {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor || 1;
  const area = clampScreenshotRect(rect, display.bounds);
  const source = await getPrimaryScreenSource(
    display.id,
    display.bounds,
    scaleFactor,
  );

  return source.thumbnail.crop({
    x: Math.round(area.left * scaleFactor),
    y: Math.round(area.top * scaleFactor),
    width: Math.round(area.width * scaleFactor),
    height: Math.round(area.height * scaleFactor),
  });
}
