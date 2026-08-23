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

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: getS3Bucket(),
        Key: capture.storageKey,
      }),
    );
    await prisma.capture.delete({ where: { id: capture.id } });
  } catch (error) {
    console.error("Could not delete capture", { captureId: capture.id, error });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
