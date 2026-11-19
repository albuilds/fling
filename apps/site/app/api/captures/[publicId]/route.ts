import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { publicId } = await params;
  const capture = await prisma.capture.findFirst({
    where: { publicId, UserId: session.user.id },
    select: { id: true, storageKey: true },
  });

  if (!capture) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Delete the database row first. Once it is gone the share link stops
  // working immediately, because media is only served through this app and
  // the bucket is private. If the storage delete then fails, the leftover
  // object is unreachable rather than leaving a broken link behind.
  try {
    const deleted = await prisma.capture.deleteMany({
      where: { id: capture.id, UserId: session.user.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Could not delete capture", { captureId: capture.id, error });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  await s3
    .send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: capture.storageKey }))
    .catch((error) =>
      console.error("Could not delete capture media from storage", {
        captureId: capture.id,
        storageKey: capture.storageKey,
        error,
      }),
    );

  return new Response(null, { status: 204 });
}
