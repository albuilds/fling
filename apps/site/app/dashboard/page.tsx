"use client";

import { useMemo, useState } from "react";
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

const initialCaptures = [
  {
    id: "product-walkthrough",
    type: "video",
    title: "Product walkthrough",
    meta: "2:14 MP4",
    expires: "12h 48m",
    size: "84 MB",
  },
  {
    id: "checkout-bug",
    type: "image",
    title: "Checkout bug",
    meta: "PNG screenshot",
    expires: "2d 3h",
    size: "3.2 MB",
  },
  {
    id: "settings-demo",
    type: "video",
    title: "Settings demo",
    meta: "0:38 MP4",
    expires: "5d 19h",
    size: "28 MB",
  },
  {
    id: "homepage-hero",
    type: "image",
    title: "Homepage hero notes",
    meta: "PNG screenshot",
    expires: "6d 4h",
    size: "5.8 MB",
  },
] as const;

type Capture = (typeof initialCaptures)[number];
type Filter = "all" | Capture["type"];

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

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [captures, setCaptures] = useState<Capture[]>([...initialCaptures]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCaptures = useMemo(() => {
    if (activeFilter === "all") {
      return captures;
    }

    return captures.filter((capture) => capture.type === activeFilter);
  }, [activeFilter, captures]);

  async function copyCaptureLink(capture: Capture) {
    const link = `https://fling.app/s/${capture.id}`;

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
          <a href="/login">Log in</a>
        </nav>
        <a className="header-action" href="#">
          <Plus size={16} />
          <span>Upload</span>
        </a>
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
            <span>Search captures</span>
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
                      {capture.meta} {"·"} {capture.size}
                    </p>
                  </div>
                  <span className="expiry-pill">
                    <TimerReset size={13} />
                    {capture.expires}
                  </span>
                </div>
                <div className="capture-actions">
                  <a href={`/dashboard/${capture.id}`} aria-label="Open capture">
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
              <strong>No captures here</strong>
              <span>Try another filter or upload a new file.</span>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
