import { timingSafeEqual } from "node:crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 100;

function hasValidSecret(request: Request) {
  const configuredSecret = process.env.CLEANUP_SECRET;
  const suppliedSecret = request.headers.get("x-cleanup-secret");

  if (!configuredSecret || !suppliedSecret) return false;

  const configured = Buffer.from(configuredSecret);
  const supplied = Buffer.from(suppliedSecret);
  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expiredCaptures = await prisma.capture.findMany({
    where: { expiresAt: { lte: new Date() } },
    orderBy: { expiresAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, storageKey: true },
  });

  let deleted = 0;
  let failed = 0;

  for (const capture of expiredCaptures) {
    try {
      // S3 DeleteObject is idempotent, so retries are safe if a previous run
      // removed the object but failed before removing the database record.
      await s3.send(
        new DeleteObjectCommand({
          Bucket: getS3Bucket(),
          Key: capture.storageKey,
        }),
      );
      await prisma.capture.deleteMany({ where: { id: capture.id } });
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error("Could not clean up expired capture", {
        captureId: capture.id,
        error,
      });
    }
  }

  const result = {
    examined: expiredCaptures.length,
    deleted,
    failed,
    hasMore: expiredCaptures.length === BATCH_SIZE,
  };

  if (failed > 0) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
