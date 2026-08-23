import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAppOrigin } from "@/lib/app-url";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { readRequestBody } from "@/lib/request-body";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MAX_UPLOAD_BYTES = 104_857_600;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function getMaxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_UPLOAD_BYTES;
}

function hasExpectedSignature(bytes: Buffer, mimeType: string) {
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

export async function GET(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const captures = await prisma.capture.findMany({
    where: { UserId: device.UserId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      publicId: true,
      type: true,
      title: true,
      mimeType: true,
      byteSize: true,
      durationMs: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const origin = getAppOrigin(request.url);
  return NextResponse.json(
    {
      captures: captures.map((capture) => ({
        ...capture,
        type: capture.type === "VIDEO" ? "video" : "image",
        byteSize: Number(capture.byteSize),
        createdAt: capture.createdAt.toISOString(),
        expiresAt: capture.expiresAt?.toISOString() ?? null,
        shareUrl: `${origin}/s/${capture.publicId}`,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mimeType =
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const extension = FILE_EXTENSIONS[mimeType];
  if (!extension) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const maxBytes = getMaxUploadBytes();
  const contentLength = request.headers.get("content-length")?.trim();
  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength)) {
      return NextResponse.json({ error: "invalid_content_length" }, { status: 400 });
    }
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes)) {
      return NextResponse.json({ error: "invalid_content_length" }, { status: 400 });
    }
    if (declaredBytes > maxBytes) {
      return NextResponse.json({ error: "file_too_large", maxBytes }, { status: 413 });
    }
  }

  const bytes = await readRequestBody(request, maxBytes);
  if (!bytes) {
    return NextResponse.json({ error: "file_too_large", maxBytes }, { status: 413 });
  }
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (!hasExpectedSignature(bytes, mimeType)) {
    return NextResponse.json({ error: "invalid_media" }, { status: 415 });
  }

  const encodedTitle = request.headers.get("x-fling-title") || "Untitled capture";
  let rawTitle = encodedTitle;
  try {
    rawTitle = decodeURIComponent(encodedTitle);
  } catch {
    // Keep the original header when it was not URI encoded.
  }
  const title =
    rawTitle.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180) ||
    "Untitled capture";
  const captureType = mimeType.startsWith("video/") ? "VIDEO" : "SCREENSHOT";
  const durationHeader = request.headers.get("x-fling-duration-ms");
  const parsedDuration = durationHeader ? Number(durationHeader) : null;
  const durationMs =
    captureType === "VIDEO" && parsedDuration !== null && Number.isFinite(parsedDuration)
      ? Math.min(MAX_DURATION_MS, Math.max(0, Math.round(parsedDuration)))
      : null;
  const storageKey = `captures/${device.UserId}/${randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: storageKey,
      Body: bytes,
      ContentType: mimeType,
      ContentLength: bytes.length,
    }),
  );

  let capture;
  try {
    capture = await prisma.capture.create({
      data: {
        UserId: device.UserId,
        deviceTokenId: device.id,
        type: captureType,
        title,
        mimeType,
        storageKey,
        byteSize: BigInt(bytes.length),
        durationMs,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, publicId: true, createdAt: true, expiresAt: true },
    });
  } catch (error) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: storageKey }))
      .catch((cleanupError) =>
        console.error("Could not clean up failed capture upload", { cleanupError }),
      );
    throw error;
  }

  const origin = getAppOrigin(request.url);
  return NextResponse.json(
    {
      ...capture,
      createdAt: capture.createdAt.toISOString(),
      expiresAt: capture.expiresAt?.toISOString() ?? null,
      shareUrl: `${origin}/s/${capture.publicId}`,
    },
    { status: 201 },
  );
}
