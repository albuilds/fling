// Rectangle math for screenshots and the recording overlay.

import type { RecordingRegion, Rect } from "./types";
import { asRecord, isFiniteNumber } from "./validation";

const RECORDING_BORDER_WIDTH = 4;
const TIMER_WIDTH = 132;
const TIMER_HEIGHT = 58;

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
 * Accepts either a plain selection or a selection plus timer from the
 * recording overlay. Returns null for anything else.
 */
export function parseRecordingRegion(value: unknown): RecordingRegion | Rect | null {
  const record = asRecord(value);
  if ("selection" in record || "timer" in record) {
    const selection = parseRect(record.selection);
    const timer = parseRect(record.timer);
    return selection && timer ? { selection, timer } : null;
  }
  return parseRect(value);
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

function getDefaultTimerRect(bounds: Electron.Rectangle): Rect {
  return {
    left: Math.round((bounds.width - TIMER_WIDTH) / 2),
    top: bounds.height - TIMER_HEIGHT - 12,
    width: TIMER_WIDTH,
    height: TIMER_HEIGHT,
  };
}

/** Converts a Rect to an Electron shape rectangle clipped to the window. */
function toShapeRect(
  rect: Rect,
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

/**
 * Builds the window shape used while recording: only the four border strips
 * around the selection and the timer stay visible and clickable, so the user
 * can keep using the apps underneath. With no region, the whole window is
 * visible again.
 *
 * The strips sit just *outside* the selection. The recorder captures exactly
 * the selection, so the frame never shows up in the video.
 */
export function buildRecordingShape(
  region: RecordingRegion | Rect | null,
  bounds: Electron.Rectangle,
): Electron.Rectangle[] {
  if (!region) {
    return [{ x: 0, y: 0, width: bounds.width, height: bounds.height }];
  }

  const selection = "selection" in region ? region.selection : region;
  const timer = "timer" in region ? region.timer : getDefaultTimerRect(bounds);
  const border = RECORDING_BORDER_WIDTH;
  const left = Math.round(selection.left);
  const top = Math.round(selection.top);
  const width = Math.round(selection.width);
  const height = Math.round(selection.height);

  return [
    // Top and bottom strips span the corners as well.
    { left: left - border, top: top - border, width: width + border * 2, height: border },
    { left: left - border, top: top + height, width: width + border * 2, height: border },
    { left: left - border, top, width: border, height },
    { left: left + width, top, width: border, height },
    timer,
  ]
    .map((rect) => toShapeRect(rect, bounds))
    .filter((rect): rect is Electron.Rectangle => rect !== null);
}
