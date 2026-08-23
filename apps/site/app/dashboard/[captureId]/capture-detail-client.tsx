"use client";

import {
  ArrowLeft,
  Copy,
  Download,
  Film,
  ImageIcon,
  Link2,
  TimerReset,
  Trash2,
  Zap,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type CaptureDetail = {
  id: string;
  publicId: string;
  type: "video" | "image";
  title: string;
  mimeType: string;
  byteSize: number;
  durationMs: number | null;
  expiresAt: string | null;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return null;
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "No expiry";
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Expired";
  const hours = Math.max(1, Math.ceil(remainingMs / 3_600_000));
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return days > 0 ? `${days}d ${remainder}h` : `${hours}h`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function CaptureDetailClient({ capture }: { capture: CaptureDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isVideo = capture.type === "video";
  const isExpired = Boolean(
    capture.expiresAt && new Date(capture.expiresAt).getTime() <= Date.now(),
  );
  const Icon = isVideo ? Film : ImageIcon;
  const contentUrl = `/api/captures/${encodeURIComponent(capture.publicId)}/content`;
  const sharePath = `/s/${encodeURIComponent(capture.publicId)}`;
  const duration = formatDuration(capture.durationMs);
  const detailLine = [
    `Uploaded ${new Date(capture.createdAt).toLocaleDateString()}`,
    duration,
    capture.mimeType.split("/").pop()?.toUpperCase(),
    formatBytes(capture.byteSize),
  ]
    .filter(Boolean)
    .join(" · ");

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 2400);
  }

  async function copyShareLink() {
    try {
      await copyText(`${window.location.origin}${sharePath}`);
      showMessage("Share link copied.");
    } catch {
      showMessage("Could not copy the share link.");
    }
  }

  async function deleteCapture() {
    if (!window.confirm(`Delete “${capture.title}”? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/captures/${encodeURIComponent(capture.publicId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete_failed");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setIsDeleting(false);
      showMessage("Could not delete the capture. Please try again.");
    }
  }

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
          <a href="/dashboard">Library</a>
          <button
            disabled={isSigningOut}
            onClick={() => {
              setIsSigningOut(true);
              void signOut({ redirectTo: "/" });
            }}
            type="button"
          >
            {isSigningOut ? "Signing out..." : "Log out"}
          </button>
        </nav>
        <a className="header-action" href="/dashboard">
          <ArrowLeft size={16} />
          <span>Back</span>
        </a>
      </header>

      <main className="detail-shell">
        <section className="detail-heading reveal">
          <a className="back-link" href="/dashboard">
            <ArrowLeft size={16} />
            Library
          </a>
          <div>
            <p className="eyebrow">
              <Icon size={14} />
              {isVideo ? "Video capture" : "Screenshot capture"}
            </p>
            <h1>{capture.title}</h1>
            <p>{detailLine}</p>
          </div>
        </section>

        <section className="detail-layout">
          <div className="media-stage reveal" aria-label={`${capture.title} preview`}>
            <div className="shared-media-frame">
              {isExpired ? (
                <div className="expired-media">
                  <TimerReset size={34} />
                  <strong>This capture has expired</strong>
                  <span>Its media and public share link are no longer available.</span>
                </div>
              ) : isVideo ? (
                <video className="shared-media" controls preload="metadata" src={contentUrl}>
                  Your browser does not support this video.
                </video>
              ) : (
                <img className="shared-media" src={contentUrl} alt={capture.title} />
              )}
            </div>
          </div>

          <aside className="detail-panel reveal" aria-label="Capture actions">
            <div className="expiry-box">
              <span>
                <TimerReset size={15} />
                {isExpired ? "Status" : "Expires in"}
              </span>
              <strong>{formatExpiry(capture.expiresAt)}</strong>
              <small>The share link stops working after expiration.</small>
            </div>

            <div className="share-link">
              <span>{sharePath}</span>
              <button
                disabled={isExpired}
                onClick={() => void copyShareLink()}
                type="button"
                aria-label="Copy share link"
              >
                <Copy size={17} />
              </button>
            </div>

            <div className="action-list">
              <button
                className="button primary"
                disabled={isExpired}
                onClick={() => void copyShareLink()}
                type="button"
              >
                <Copy size={18} />
                <span>Copy link</span>
              </button>
              {isExpired ? (
                <button className="button secondary" disabled type="button">
                  <Download size={18} />
                  <span>Download unavailable</span>
                </button>
              ) : (
                <a className="button secondary" href={contentUrl} download={capture.title}>
                  <Download size={18} />
                  <span>Download</span>
                </a>
              )}
              {isExpired ? (
                <button className="button secondary" disabled type="button">
                  <Link2 size={18} />
                  <span>Share page unavailable</span>
                </button>
              ) : (
                <a className="button secondary" href={sharePath} target="_blank" rel="noreferrer">
                  <Link2 size={18} />
                  <span>Open share page</span>
                </a>
              )}
              <button
                className="button danger"
                disabled={isDeleting}
                onClick={() => void deleteCapture()}
                type="button"
              >
                <Trash2 size={18} />
                <span>{isDeleting ? "Deleting…" : `Delete ${capture.type}`}</span>
              </button>
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
      {message ? (
        <div className="dashboard-toast" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}
