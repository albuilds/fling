import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { parseByteRange } from "@/lib/range";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_CACHE_SECONDS = 300;

type RouteContext = { params: Promise<{ publicId: string }> };
type Capture = NonNullable<Awaited<ReturnType<typeof getCapture>>>;

async function getCapture(publicId: string) {
  return prisma.capture.findUnique({
    where: { publicId },
    select: {
      storageKey: true,
      mimeType: true,
      title: true,
      byteSize: true,
      expiresAt: true,
    },
  });
}

function isAvailable(
  capture: Awaited<ReturnType<typeof getCapture>>,
): capture is Capture {
  return Boolean(capture && !(capture.expiresAt && capture.expiresAt <= new Date()));
}

function isMissingObjectError(error: unknown) {
  const name = (error as { name?: string } | null)?.name;
  return name === "NoSuchKey" || name === "NotFound";
}

function encodeContentDispositionValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Browsers and proxies may cache media for a few minutes, but never past the
 * link's expiry. `private` keeps shared caches (CDNs, proxies) from storing
 * it, so deleting or expiring a capture takes effect for everyone.
 */
function getCacheControl(expiresAt: Date | null) {
  const secondsLeft = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    : MAX_CACHE_SECONDS;
  const maxAge = Math.max(0, Math.min(MAX_CACHE_SECONDS, secondsLeft));
  return `private, max-age=${maxAge}`;
}

function createMediaHeaders(
  capture: Capture,
  { contentLength, etag }: { contentLength?: number; etag?: string },
) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": getCacheControl(capture.expiresAt),
    "content-disposition": `inline; filename*=UTF-8''${encodeContentDispositionValue(capture.title)}`,
    "content-security-policy": "default-src 'none'; sandbox",
    "content-type": capture.mimeType,
    "x-content-type-options": "nosniff",
  });
  if (contentLength !== undefined) {
    headers.set("content-length", String(contentLength));
  }
  if (etag) headers.set("etag", etag);
  return headers;
}

function rangeNotSatisfiable(size: bigint) {
  return new Response(null, {
    status: 416,
    headers: { "content-range": `bytes */${size}` },
  });
}

export async function HEAD(_request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);
  if (!isAvailable(capture)) return new Response(null, { status: 404 });

  try {
    const object = await s3.send(
      new HeadObjectCommand({ Bucket: getS3Bucket(), Key: capture.storageKey }),
    );
    const headers = createMediaHeaders(capture, {
      contentLength: object.ContentLength,
      etag: object.ETag,
    });
    return new Response(null, { status: 200, headers });
  } catch (error) {
    if (isMissingObjectError(error)) return new Response(null, { status: 404 });
    throw error;
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);
  if (!isAvailable(capture)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Video players request byte ranges so they can seek and stream. Only a
  // single, well-formed range is forwarded to storage.
  const range = parseByteRange(request.headers.get("range"), Number(capture.byteSize));
  if (range.kind === "unsatisfiable") return rangeNotSatisfiable(capture.byteSize);

  let object;
  try {
    object = await s3.send(
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: capture.storageKey,
        Range: range.kind === "satisfiable" ? range.header : undefined,
      }),
    );
  } catch (error) {
    if (isMissingObjectError(error)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if ((error as { name?: string } | null)?.name === "InvalidRange") {
      return rangeNotSatisfiable(capture.byteSize);
    }
    throw error;
  }

  if (!object.Body) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = createMediaHeaders(capture, {
    contentLength: object.ContentLength,
    etag: object.ETag,
  });
  if (object.ContentRange) headers.set("content-range", object.ContentRange);

  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  });
}
