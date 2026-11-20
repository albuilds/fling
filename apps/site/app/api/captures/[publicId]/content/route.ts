// Serves a capture's bytes from S3. Used by <img>/<video> src on the share page.
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { parseByteRange } from "@/lib/range";
import { getS3Bucket, s3 } from "@/lib/s3";
import { NextResponse } from "next/server";

// AWS SDK and Prisma need Node, not Edge.
export const runtime = "nodejs";

const MAX_CACHE_SECONDS = 300;

type RouteContext = { params: Promise<{ publicId: string }> };
type Capture = NonNullable<Awaited<ReturnType<typeof getCapture>>>;

// Metadata only. The bytes live in S3 at storageKey.
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

// Exists and not expired.
function isAvailable(
  capture: Awaited<ReturnType<typeof getCapture>>,
): capture is Capture {
  return Boolean(capture && !(capture.expiresAt && capture.expiresAt <= new Date()));
}

// GET throws NoSuchKey, HEAD throws NotFound.
function isMissingObjectError(error: unknown) {
  const name = (error as { name?: string } | null)?.name;
  return name === "NoSuchKey" || name === "NotFound";
}

// encodeURIComponent skips !'()*, but filename* needs them encoded.
function encodeContentDispositionValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// Browser-only cache, 5 min max, never past expiry.
function getCacheControl(expiresAt: Date | null) {
  const secondsLeft = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    : MAX_CACHE_SECONDS;
  const maxAge = Math.max(0, Math.min(MAX_CACHE_SECONDS, secondsLeft));
  return `private, max-age=${maxAge}`;
}

// Shared by GET and HEAD. CSP + nosniff stop uploads from running as pages.
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

// 416: range starts past the end of the file.
function rangeNotSatisfiable(size: bigint) {
  return new Response(null, {
    status: 416,
    headers: { "content-range": `bytes */${size}` },
  });
}

// Headers only, no body. For clients checking size/type first.
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

// Images: no Range, whole file, 200. Videos: Range for seeking, 206.
export async function GET(request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);
  if (!isAvailable(capture)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const range = parseByteRange(request.headers.get("range"), Number(capture.byteSize));
  if (range.kind === "unsatisfiable") return rangeNotSatisfiable(capture.byteSize);

  // S3 handles the range, so only the requested bytes are fetched.
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
    // DB byteSize disagrees with the real file.
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

  // Node stream -> Web stream, piped to the browser chunk by chunk.
  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  });
}
