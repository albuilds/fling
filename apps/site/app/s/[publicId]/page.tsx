import { getAppOrigin } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { Download, Film, ImageIcon, TimerReset, Zap } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

type SharePageProps = { params: Promise<{ publicId: string }> };

function formatBytes(bytes: bigint) {
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function formatExpiry(expiresAt: Date | null) {
  if (!expiresAt) return "No expiry";
  const remainingMs = expiresAt.getTime() - Date.now();
  const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h` : `${Math.ceil(hours / 24)}d`;
}

const getCapture = cache(async (publicId: string) =>
  prisma.capture.findUnique({
    where: { publicId },
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
  }),
);

async function getRequestOrigin() {
  if (process.env.APP_BASE_URL) return getAppOrigin();

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || requestHeaders.get("host");

  if (host) {
    const forwardedProtocol = requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim();
    const protocol =
      forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
    return getAppOrigin(`${protocol}://${host}`);
  }

  return getAppOrigin("http://localhost:3000");
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { publicId } = await params;
  const capture = await getCapture(publicId);
  const isExpired = Boolean(
    capture?.expiresAt && capture.expiresAt.getTime() <= Date.now(),
  );

  if (!capture || isExpired) {
    return {
      title: "Capture not found · Fling",
      description: "This Fling capture is unavailable or has expired.",
      robots: { index: false, follow: false },
    };
  }

  const origin = await getRequestOrigin();
  const shareUrl = new URL(`/s/${encodeURIComponent(publicId)}`, origin);
  const mediaUrl = new URL(
    `/api/captures/${encodeURIComponent(publicId)}/content`,
    origin,
  );
  const isVideo = capture.type === "VIDEO";
  const title = `${capture.title} · Fling`;
  const description = `${isVideo ? "Video" : "Screenshot"} shared with Fling · ${formatBytes(capture.byteSize)} · Expires in ${formatExpiry(capture.expiresAt)}`;
  const commonOpenGraph = {
    title,
    description,
    url: shareUrl,
    siteName: "Fling",
    locale: "en_US",
  } as const;

  if (isVideo) {
    return {
      title,
      description,
      alternates: { canonical: shareUrl },
      openGraph: {
        ...commonOpenGraph,
        type: "video.other",
        videos: [
          {
            url: mediaUrl,
            secureUrl: mediaUrl.protocol === "https:" ? mediaUrl : undefined,
            type: capture.mimeType,
            width: 1280,
            height: 720,
          },
        ],
      },
      twitter: {
        card: "player",
        title,
        description,
        players: [
          {
            playerUrl: shareUrl,
            streamUrl: mediaUrl,
            width: 1280,
            height: 720,
          },
        ],
      },
      other: {
        "twitter:player:stream:content_type": capture.mimeType,
      },
    };
  }

  const image = {
    url: mediaUrl,
    secureUrl: mediaUrl.protocol === "https:" ? mediaUrl : undefined,
    alt: capture.title,
    type: capture.mimeType,
  };

  return {
    title,
    description,
    alternates: { canonical: shareUrl },
    openGraph: {
      ...commonOpenGraph,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { publicId } = await params;
  const capture = await getCapture(publicId);

  if (!capture || (capture.expiresAt && capture.expiresAt <= new Date())) {
    notFound();
  }

  const mediaUrl = `/api/captures/${encodeURIComponent(publicId)}/content`;
  const isVideo = capture.type === "VIDEO";
  const Icon = isVideo ? Film : ImageIcon;

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Fling home">
          <span className="logo" aria-hidden="true">
            <Zap size={18} strokeWidth={2.5} />
          </span>
          <span>Fling</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="/login">Log in</a>
        </nav>
      </header>

      <main className="detail-shell">
        <section className="detail-heading reveal">
          <div>
            <p className="eyebrow">
              <Icon size={14} />
              {isVideo ? "Video share" : "Screenshot share"}
            </p>
            <h1>{capture.title}</h1>
            <p>
              Uploaded {capture.createdAt.toLocaleDateString()} ·{" "}
              {formatBytes(capture.byteSize)}
            </p>
          </div>
        </section>

        <section className="detail-layout">
          <div className="media-stage reveal">
            <div className="shared-media-frame">
              {isVideo ? (
                <video className="shared-media" controls preload="metadata" src={mediaUrl}>
                  Your browser does not support this video.
                </video>
              ) : (
                <img className="shared-media" src={mediaUrl} alt={capture.title} />
              )}
            </div>
          </div>

          <aside className="detail-panel reveal" aria-label="Capture details">
            <div className="expiry-box">
              <span>
                <TimerReset size={15} />
                Expires in
              </span>
              <strong>{formatExpiry(capture.expiresAt)}</strong>
              <small>The share link stops working after expiration.</small>
            </div>

            <div className="action-list">
              <a className="button primary" href={mediaUrl} download={capture.title}>
                <Download size={18} />
                <span>Download</span>
              </a>
            </div>

            <div className="detail-meta">
              <div>
                <span>Type</span>
                <strong>{capture.mimeType}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{formatBytes(capture.byteSize)}</strong>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
