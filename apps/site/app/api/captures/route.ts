import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAppOrigin } from "@/lib/app-url";
import { authenticateDevice } from "@/lib/device-auth";
import {
  getMaxUploadBytes,
  hasExpectedSignature,
  MEDIA_EXTENSIONS,
  parseDurationMs,
  parseMediaType,
  sanitizeTitle,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { readRequestBody } from "@/lib/request-body";
import { getS3Bucket, s3 } from "@/lib/s3";
import { createShareId } from "@/lib/secrets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SHARE_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

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

  const mimeType = parseMediaType(request.headers.get("content-type"));
  const extension = MEDIA_EXTENSIONS[mimeType];
  if (!extension) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  // Reject obviously oversized uploads before reading the body. The header can
  // be missing or wrong, so readRequestBody enforces the limit again below.
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

  const title = sanitizeTitle(request.headers.get("x-fling-title"));
  const captureType = mimeType.startsWith("video/") ? "VIDEO" : "SCREENSHOT";
  const durationMs = parseDurationMs(
    request.headers.get("x-fling-duration-ms"),
    captureType === "VIDEO",
  );
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
        publicId: createShareId(),
        type: captureType,
        title,
        mimeType,
        storageKey,
        byteSize: BigInt(bytes.length),
        durationMs,
        expiresAt: new Date(Date.now() + SHARE_LINK_LIFETIME_MS),
      },
      select: { id: true, publicId: true, createdAt: true, expiresAt: true },
    });
  } catch (error) {
    // The file is already in storage but has no database row, so nothing
    // could ever serve or clean it up. Remove it before reporting the error.
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
