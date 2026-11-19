export const DEFAULT_MAX_UPLOAD_BYTES = 104_857_600;
export const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Media types the upload API accepts, mapped to their file extension. */
export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function getMaxUploadBytes(configured = process.env.MAX_UPLOAD_BYTES) {
  const value = Number(configured);
  return Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_MAX_UPLOAD_BYTES;
}

/** Returns the lowercase media type from a Content-Type header, without parameters. */
export function parseMediaType(contentType: string | null) {
  return contentType?.split(";")[0].trim().toLowerCase() || "";
}

/**
 * Checks the file's leading "magic bytes" so a client cannot upload, say,
 * an HTML page labeled as `image/png`.
 */
export function hasExpectedSignature(bytes: Buffer, mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "video/mp4":
      return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/webm":
      return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
}

/** Removes control characters and limits length; falls back to a default title. */
export function sanitizeTitle(encodedTitle: string | null) {
  let rawTitle = encodedTitle || "";
  try {
    rawTitle = decodeURIComponent(rawTitle);
  } catch {
    // Keep the original header when it was not URI encoded.
  }
  return (
    rawTitle.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180) ||
    "Untitled capture"
  );
}

/** Parses the optional duration header for videos, clamped to a sane range. */
export function parseDurationMs(header: string | null, isVideo: boolean) {
  if (!isVideo || !header) return null;
  const parsed = Number(header);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(MAX_DURATION_MS, Math.max(0, Math.round(parsed)));
}
