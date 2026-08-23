import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ publicId: string }> };

async function getCapture(publicId: string) {
  return prisma.capture.findUnique({
    where: { publicId },
    select: { storageKey: true, mimeType: true, title: true, expiresAt: true },
  });
}

function isUnavailable(capture: Awaited<ReturnType<typeof getCapture>>) {
  return !capture || Boolean(capture.expiresAt && capture.expiresAt <= new Date());
}

function createMediaHeaders({
  title,
  mimeType,
  contentLength,
  etag,
}: {
  title: string;
  mimeType: string;
  contentLength?: number;
  etag?: string;
}) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=300",
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(title)}`,
    "content-type": mimeType,
  });
  if (contentLength !== undefined) {
    headers.set("content-length", String(contentLength));
  }
  if (etag) headers.set("etag", etag);
  return headers;
}

export async function HEAD(_request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);

  if (isUnavailable(capture) || !capture) {
    return new Response(null, { status: 404 });
  }

  const object = await s3.send(
    new HeadObjectCommand({
      Bucket: getS3Bucket(),
      Key: capture.storageKey,
    }),
  );
  const headers = createMediaHeaders({
    title: capture.title,
    mimeType: object.ContentType ?? capture.mimeType,
    contentLength: object.ContentLength,
    etag: object.ETag,
  });

  return new Response(null, { status: 200, headers });
}

export async function GET(request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);

  if (isUnavailable(capture) || !capture) {
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

  const headers = createMediaHeaders({
    title: capture.title,
    mimeType: object.ContentType ?? capture.mimeType,
    contentLength: object.ContentLength,
    etag: object.ETag,
  });
  if (object.ContentRange) headers.set("content-range", object.ContentRange);

  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  });
}
