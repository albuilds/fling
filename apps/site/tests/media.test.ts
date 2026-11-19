import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  getMaxUploadBytes,
  hasExpectedSignature,
  MAX_DURATION_MS,
  parseDurationMs,
  parseMediaType,
  sanitizeTitle,
} from "@/lib/media";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]);
const HTML = Buffer.from("<!doctype html><script>alert(1)</script>");

describe("hasExpectedSignature", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/webp", WEBP],
    ["video/mp4", MP4],
    ["video/webm", WEBM],
  ])("accepts a real %s file", (mimeType, bytes) => {
    expect(hasExpectedSignature(bytes, mimeType)).toBe(true);
  });

  it.each(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"])(
    "rejects an HTML page labeled as %s",
    (mimeType) => {
      expect(hasExpectedSignature(HTML, mimeType)).toBe(false);
    },
  );

  it("rejects a file whose bytes match a different type", () => {
    expect(hasExpectedSignature(PNG, "image/jpeg")).toBe(false);
  });

  it("rejects files too short to contain a signature", () => {
    expect(hasExpectedSignature(Buffer.from([0xff, 0xd8]), "image/jpeg")).toBe(false);
    expect(hasExpectedSignature(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("rejects unsupported media types", () => {
    expect(hasExpectedSignature(HTML, "text/html")).toBe(false);
  });
});

describe("parseMediaType", () => {
  it("drops parameters and lowercases", () => {
    expect(parseMediaType("Image/PNG; charset=binary")).toBe("image/png");
  });

  it("returns an empty string when the header is missing", () => {
    expect(parseMediaType(null)).toBe("");
  });
});

describe("getMaxUploadBytes", () => {
  it("uses a valid configured value", () => {
    expect(getMaxUploadBytes("2048")).toBe(2048);
  });

  it.each([undefined, "", "abc", "-5", "0", "1.5"])(
    "falls back to the default for %j",
    (value) => {
      expect(getMaxUploadBytes(value)).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    },
  );
});

describe("sanitizeTitle", () => {
  it("decodes URI-encoded titles", () => {
    expect(sanitizeTitle(encodeURIComponent("Bug report #2.png"))).toBe(
      "Bug report #2.png",
    );
  });

  it("keeps titles that are not URI encoded", () => {
    expect(sanitizeTitle("100% done")).toBe("100% done");
  });

  it("replaces control characters", () => {
    expect(sanitizeTitle(encodeURIComponent("a\nb\u0000c"))).toBe("a b c");
  });

  it("limits the length to 180 characters", () => {
    expect(sanitizeTitle("x".repeat(500))).toHaveLength(180);
  });

  it("falls back when the title is empty", () => {
    expect(sanitizeTitle(null)).toBe("Untitled capture");
    expect(sanitizeTitle("   ")).toBe("Untitled capture");
  });
});

describe("parseDurationMs", () => {
  it("only applies to videos", () => {
    expect(parseDurationMs("5000", false)).toBeNull();
  });

  it("rounds valid values", () => {
    expect(parseDurationMs("8123.6", true)).toBe(8124);
  });

  it("clamps out-of-range values", () => {
    expect(parseDurationMs("-10", true)).toBe(0);
    expect(parseDurationMs(String(MAX_DURATION_MS * 2), true)).toBe(MAX_DURATION_MS);
  });

  it("ignores missing or invalid values", () => {
    expect(parseDurationMs(null, true)).toBeNull();
    expect(parseDurationMs("soon", true)).toBeNull();
  });
});
