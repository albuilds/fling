import { prisma } from "@/lib/prisma";
import { Download, Film, ImageIcon, TimerReset, Zap } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

async function getCapture(publicId: string) {
  return prisma.capture.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      type: true,
      title: true,
      mimeType: true,
      byteSize: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { publicId } = await params;
  const capture = await getCapture(publicId);
  return capture
    ? { title: `${capture.title} · Fling` }
    : { title: "Capture not found · Fling" };
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
