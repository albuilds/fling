// Rectangle math for screenshots and the recording overlay.

import type { Rect } from "./types";
import { asRecord, isFiniteNumber } from "./validation";

const TIMER_WIDTH = 206;
const TIMER_HEIGHT = 78;
const TIMER_GAP = 10;

/** Returns a Rect when every field is a finite number, otherwise null. */
export function parseRect(value: unknown): Rect | null {
  const { left, top, width, height } = asRecord(value);
  if (
    !isFiniteNumber(left) ||
    !isFiniteNumber(top) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height)
  ) {
    return null;
  }
  return { left, top, width, height };
}

/**
 * Clamps a selection to the display. An empty or missing selection means
 * "capture the whole screen".
 */
export function clampScreenshotRect(
  rect: Rect | null,
  bounds: Electron.Rectangle,
): Rect {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { left: 0, top: 0, width: bounds.width, height: bounds.height };
  }

  const left = Math.max(0, Math.min(rect.left, bounds.width));
  const top = Math.max(0, Math.min(rect.top, bounds.height));
  const right = Math.max(left, Math.min(rect.left + rect.width, bounds.width));
  const bottom = Math.max(top, Math.min(rect.top + rect.height, bounds.height));

  return { left, top, width: right - left, height: bottom - top };
}

/** Places the timer outside the selected area whenever there is room. */
export function getRecordingControlsBounds(
  selection: Rect,
  bounds: Electron.Rectangle,
  otherWorkAreas: Electron.Rectangle[],
): Electron.Rectangle {
  const width = Math.min(TIMER_WIDTH, bounds.width);
  const height = Math.min(TIMER_HEIGHT, bounds.height);
  const right = selection.left + selection.width;
  const bottom = selection.top + selection.height;
  const maxX = bounds.width - width;
  const maxY = bounds.height - height;
  const centerX = Math.max(0, Math.min(maxX, selection.left + (selection.width - width) / 2));
  const centerY = Math.max(0, Math.min(maxY, selection.top + (selection.height - height) / 2));
  const preferred = [
    bottom <= maxY && { x: centerX, y: Math.min(maxY, bottom + TIMER_GAP) },
    selection.top >= height && { x: centerX, y: Math.max(0, selection.top - height - TIMER_GAP) },
    right <= maxX && { x: Math.min(maxX, right + TIMER_GAP), y: centerY },
    selection.left >= width && { x: Math.max(0, selection.left - width - TIMER_GAP), y: centerY },
  ];
  const position = preferred.find(Boolean);
  if (position) {
    return { x: bounds.x + Math.round(position.x), y: bounds.y + Math.round(position.y), width, height };
  }

  const nearX = bounds.x + selection.left + selection.width / 2;
  const nearY = bounds.y + selection.top + selection.height / 2;
  let closest: Electron.Rectangle | null = null;
  let closestDistance = Infinity;
  for (const area of otherWorkAreas) {
    if (area.width < TIMER_WIDTH || area.height < TIMER_HEIGHT) continue;
    const x = Math.max(area.x, Math.min(nearX - TIMER_WIDTH / 2, area.x + area.width - TIMER_WIDTH));
    const y = Math.max(area.y, Math.min(nearY - TIMER_HEIGHT / 2, area.y + area.height - TIMER_HEIGHT));
    const distance = Math.hypot(x + TIMER_WIDTH / 2 - nearX, y + TIMER_HEIGHT / 2 - nearY);
    if (distance < closestDistance) {
      closest = { x: Math.round(x), y: Math.round(y), width: TIMER_WIDTH, height: TIMER_HEIGHT };
      closestDistance = distance;
    }
  }

  return closest ?? { x: bounds.x + Math.round(centerX), y: bounds.y + Math.max(0, maxY - TIMER_GAP), width, height };
}
