import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await prisma.capture.findUnique({
    where: { publicId },
    select: { storageKey: true, mimeType: true, title: true, expiresAt: true },
  });

  if (!capture || (capture.expiresAt && capture.expiresAt <= new Date())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const object = await s3.send(
    new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: capture.storageKey,
      Range: request.headers.get("range") ?? undefined,
    }),
  );

  if (!object.Body) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = new Headers({
    "accept-ranges": object.AcceptRanges ?? "bytes",
    "cache-control": "public, max-age=300",
    "content-disposition": `inline; filename*=UTF-8\'\'${encodeURIComponent(capture.title)}`,
    "content-type": object.ContentType ?? capture.mimeType,
  });

  if (object.ContentLength !== undefined) {
    headers.set("content-length", String(object.ContentLength));
  }
  if (object.ContentRange) headers.set("content-range", object.ContentRange);
  if (object.ETag) headers.set("etag", object.ETag);

  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  });
}
