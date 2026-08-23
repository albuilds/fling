import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/webm",
  "video/mp4",
]);

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

  const origin = process.env.APP_BASE_URL || new URL(request.url).origin;
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

  const mimeType = request.headers.get("content-type")?.split(";")[0].trim() || "";
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 104_857_600);
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > maxBytes) {
    return NextResponse.json({ error: "file_too_large", maxBytes }, { status: 413 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (bytes.length > maxBytes) {
    return NextResponse.json({ error: "file_too_large", maxBytes }, { status: 413 });
  }

  const encodedTitle = request.headers.get("x-fling-title") || "Untitled capture";
  let rawTitle = encodedTitle;
  try {
    rawTitle = decodeURIComponent(encodedTitle);
  } catch {
    // Keep the original header when it was not URI encoded.
  }
  const title = rawTitle.trim().slice(0, 180) || "Untitled capture";
  const captureType = mimeType.startsWith("video/") ? "VIDEO" : "SCREENSHOT";
  const durationHeader = request.headers.get("x-fling-duration-ms");
  const parsedDuration = durationHeader ? Number(durationHeader) : null;
  const durationMs =
    captureType === "VIDEO" && parsedDuration !== null && Number.isFinite(parsedDuration)
      ? Math.max(0, Math.round(parsedDuration))
      : null;
  const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
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

  const capture = await prisma.capture.create({
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

  const origin = process.env.APP_BASE_URL || new URL(request.url).origin;
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
