"use client";

import { useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  ArrowUpRight,
  Copy,
  Film,
  Image,
  MoreHorizontal,
  Plus,
  Search,
  TimerReset,
  Zap,
} from "lucide-react";

type Capture = {
  id: string;
  publicId: string;
  type: "video" | "image";
  title: string;
  mimeType: string;
  byteSize: number;
  durationMs: number | null;
  expiresAt: string | null;
};
type Filter = "all" | Capture["type"];
type DashboardUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Videos", value: "video" },
  { label: "Screenshots", value: "image" },
];

function Logo() {
  return (
    <span className="logo" aria-label="Fling">
      <Zap size={18} strokeWidth={2.5} />
    </span>
  );
}

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

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "No expiry";

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Expired";

  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;

  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function DashboardClient({
  user,
  initialCaptures,
}: {
  user: DashboardUser;
  initialCaptures: Capture[];
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [captures, setCaptures] = useState<Capture[]>(initialCaptures);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = user.name || user.email || "Account";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "?";

  const filteredCaptures = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return captures.filter((capture) => {
      const matchesFilter =
        activeFilter === "all" || capture.type === activeFilter;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        capture.title.toLowerCase().includes(normalizedQuery) ||
        capture.mimeType.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, captures, searchQuery]);

  async function copyCaptureLink(capture: Capture) {
    const link = `${window.location.origin}/s/${capture.publicId}`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link);
    }

    setCopiedId(capture.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  function deleteCapture(captureId: string) {
    setCaptures((current) =>
      current.filter((capture) => capture.id !== captureId),
    );
    setOpenMenu(null);
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Fling home">
          <Logo />
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
        <a className="header-action" href="#">
          <Plus size={16} />
          <span>Upload</span>
        </a>
        <div className="account-chip" title={user.email || displayName}>
          <span className="account-avatar" aria-hidden="true">
            {user.image && !avatarFailed ? (
              <img
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              avatarInitial
            )}
          </span>
          <span className="account-name">{displayName}</span>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="dashboard-heading reveal">
          <div>
            <p className="eyebrow">
              <TimerReset size={14} />
              Capture library
            </p>
            <h1>Dashboard</h1>
            <p>
              Review uploaded videos and screenshots, copy active links, and
              track expiration windows.
            </p>
          </div>
          <div className="usage-panel" aria-label="Total usage limit">
            <span>Total usage</span>
            <strong>6.4 GB / 10 GB</strong>
            <i />
            <small>64% used</small>
          </div>
        </section>

        <section className="library-toolbar reveal" aria-label="Library tools">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search captures"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setOpenMenu(null);
              }}
              placeholder="Search captures"
              type="search"
              value={searchQuery}
            />
          </div>
          <div className="filter-tabs" aria-label="Capture filters">
            {filters.map((filter) => (
              <button
                className={activeFilter === filter.value ? "active" : ""}
                key={filter.value}
                onClick={() => {
                  setActiveFilter(filter.value);
                  setOpenMenu(null);
                }}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="capture-grid" aria-label="Uploaded captures">
          {filteredCaptures.map((capture) => {
            const Icon = capture.type === "video" ? Film : Image;
            const duration = formatDuration(capture.durationMs);
            const format = capture.mimeType.split("/").pop()?.toUpperCase();
            const meta = [duration, format].filter(Boolean).join(" ");

            return (
              <article className="capture-card reveal" key={capture.id}>
                <a className="capture-thumb" href={`/dashboard/${capture.id}`}>
                  <Icon size={34} />
                  <span>{capture.type}</span>
                </a>
                <div className="capture-card-body">
                  <div>
                    <h2>{capture.title}</h2>
                    <p>
                      {meta} {"·"} {formatBytes(capture.byteSize)}
                    </p>
                  </div>
                  <span className="expiry-pill">
                    <TimerReset size={13} />
                    {formatExpiry(capture.expiresAt)}
                  </span>
                </div>
                <div className="capture-actions">
                  <a
                    href={`/dashboard/${capture.id}`}
                    aria-label="Open capture"
                  >
                    <ArrowUpRight size={17} />
                  </a>
                  <button
                    onClick={() => copyCaptureLink(capture)}
                    type="button"
                    aria-label="Copy link"
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    aria-expanded={openMenu === capture.id}
                    aria-label="More actions"
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === capture.id ? null : capture.id,
                      )
                    }
                    type="button"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                {openMenu === capture.id ? (
                  <div className="capture-menu">
                    <a href={`/dashboard/${capture.id}`}>Open capture</a>
                    <button
                      onClick={() => copyCaptureLink(capture)}
                      type="button"
                    >
                      {copiedId === capture.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteCapture(capture.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {filteredCaptures.length === 0 ? (
            <div className="empty-state">
              <strong>
                {captures.length === 0 ? "No captures yet" : "No matches"}
              </strong>
              <span>
                {captures.length === 0
                  ? "Upload a video or screenshot to get started."
                  : "Try another search or filter."}
              </span>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
