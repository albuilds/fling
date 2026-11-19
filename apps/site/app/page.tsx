import { auth } from "@/auth";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clipboard,
  Cloud,
  Download,
  Film,
  MonitorUp,
  MousePointer2,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Brand, LogoMark } from "./components/logo";

const REPOSITORY_URL = "https://github.com/albuilds/fling";

const workflowItems = [
  {
    icon: MousePointer2,
    title: "Select the exact area",
    body: "Drag once, adjust nothing, and capture the region that matters.",
  },
  {
    icon: Clipboard,
    title: "Copy or save instantly",
    body: "Keep local files, copy screenshots, or move straight into sharing.",
  },
  {
    icon: Film,
    title: "Record the same way",
    body: "Use the same overlay for short, focused screen recordings.",
  },
];

const previewSections = [
  {
    icon: SlidersHorizontal,
    title: "After Capture",
    rows: [
      {
        title: "Open in browser",
        body: "Automatically open a new tab after each capture",
        control: "toggle",
        enabled: true,
      },
      {
        title: "Copy URL to clipboard",
        body: "Copy the share link immediately after upload",
        control: "toggle",
        enabled: true,
      },
    ],
  },
  {
    icon: MonitorUp,
    title: "Keyboard Shortcuts",
    rows: [
      {
        title: "Capture region",
        body: "Select and capture a region of the screen",
        control: "shortcut",
        value: "Ctrl Shift S",
      },
      {
        title: "Record video",
        body: "Start or stop a screen recording",
        control: "shortcut",
        value: "Ctrl Shift R",
      },
    ],
  },
  {
    icon: Cloud,
    title: "Local Defaults",
    rows: [
      {
        title: "Save local copy",
        body: "Keep screenshots and recordings on this computer",
        control: "toggle",
        enabled: false,
      },
      {
        title: "Recording quality",
        body: "Default output for region recordings",
        control: "select",
        value: "Medium",
      },
    ],
  },
];

type PreviewRow = (typeof previewSections)[number]["rows"][number];

function PreviewControl({ row }: { row: PreviewRow }) {
  if (row.control === "shortcut") {
    return <span className="shortcut-token">{row.value}</span>;
  }

  if (row.control === "select") {
    return <span className="select-token">{row.value}</span>;
  }

  return <span className={row.enabled ? "toggle-on" : "toggle-off"} />;
}

function ProductScene() {
  return (
    <div className="scene reveal" aria-hidden="true">
      <div className="scene-window">
        <div className="scene-titlebar">
          <div className="scene-brand">
            <LogoMark size={16} />
            <span>fling</span>
          </div>
          <span className="scene-version">v0.1.0</span>
          <div className="scene-controls">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="scene-desktop">
          <div className="settings-preview">
            <div className="preview-main">
              {previewSections.map((section) => {
                const Icon = section.icon;

                return (
                  <section className="preview-section" key={section.title}>
                    <div className="preview-section-header">
                      <Icon size={13} />
                      {section.title}
                    </div>
                    {section.rows.map((row) => (
                      <div className="preview-row" key={row.title}>
                        <div className="preview-label">
                          <strong>{row.title}</strong>
                          <span>{row.body}</span>
                        </div>
                        <PreviewControl row={row} />
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
            <div className="settings-footer">
              <span className="save-status">
                <Check size={13} />
                Settings saved
              </span>
              <span className="footer-action ghost">Reset</span>
              <span className="footer-action primary">Save</span>
            </div>
          </div>

          <div className="overlay-preview">
            <div className="scene-hint">Drag to select a screenshot area</div>
            <div className="capture-region">
              <span className="crosshair horizontal" />
              <span className="crosshair vertical" />
              <span className="region-size">1280 × 720</span>
            </div>
            <div className="capture-toolbar">
              <span className="option active">Copy</span>
              <span className="option active">Save</span>
              <span className="option disabled">Upload</span>
              <span className="primary-action">Capture</span>
              <span className="ghost-action">Esc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="app">
      <header className="site-header">
        <Brand href="#top" />
        <nav className="nav" aria-label="Primary navigation">
          <a href="#workflow">Workflow</a>
          <a href="#capture">Sharing</a>
          <a href="#download">Download</a>
        </nav>
        <div className="header-buttons">
          <a className="header-login" href="/login">
            Log in
          </a>
          <a className="header-action" href="#download">
            <Download size={15} />
            <span>Get Fling</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-layout">
            <div className="hero-content reveal">
              <p className="eyebrow">
                <MonitorUp size={13} />
                Desktop screen capture
              </p>
              <h1 id="hero-title">
                Capture it.
                <br />
                <em>Fling it.</em>
              </h1>
              <p className="hero-copy">
                Screenshots and short screen recordings from a keyboard
                shortcut, saved to your computer or shared as a link that
                expires on its own.
              </p>
              <div className="hero-actions" aria-label="Primary actions">
                <a className="button primary" href="#download">
                  <Download size={17} />
                  <span>Download app</span>
                </a>
                <a className="button secondary" href="#workflow">
                  <Play size={17} />
                  <span>See how it works</span>
                </a>
              </div>
            </div>
            <ProductScene />
          </div>
          <div className="hero-stats reveal" aria-label="Highlights">
            <div>
              <strong>Region</strong>
              <span>Screenshot any part of the screen</span>
            </div>
            <div>
              <strong>Video</strong>
              <span>Timed recordings with audio</span>
            </div>
            <div>
              <strong>Links</strong>
              <span>Shares expire after seven days</span>
            </div>
          </div>
        </section>

        <section className="workflow" id="workflow" aria-labelledby="workflow-title">
          <div className="section-heading reveal">
            <p className="eyebrow">How it works</p>
            <h2 id="workflow-title">
              Capture, decide, <em>move on.</em>
            </h2>
          </div>
          <div className="workflow-grid">
            {workflowItems.map((item) => {
              const Icon = item.icon;

              return (
                <article className="feature-card reveal" key={item.title}>
                  <div className="feature-icon">
                    <Icon size={18} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="capture-band" id="capture" aria-labelledby="capture-title">
          <div className="capture-copy reveal">
            <p className="eyebrow">Sharing</p>
            <h2 id="capture-title">
              Local first. <em>Shareable when you want.</em>
            </h2>
            <p>
              Captures save to your computer by default. Connect the desktop app
              to your account once, and uploads come back as a link that stops
              working after seven days.
            </p>
          </div>
          <div className="capability-list">
            {[
              "Shortcuts for region, full screen, and recording",
              "Save locally, copy to the clipboard, or upload",
              "Share links expire automatically",
            ].map((item) => (
              <div className="capability reveal" key={item}>
                <Check size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="download reveal" id="download" aria-labelledby="download-title">
          <div>
            <p className="eyebrow">Get started</p>
            <h2 id="download-title">
              Fast capture, <em>no ceremony.</em>
            </h2>
          </div>
          <a className="button primary" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <span>View on GitHub</span>
            <ArrowUpRight size={17} />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <Brand href="#top" />
        <span>MIT License</span>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          Source
          <ArrowRight size={14} />
        </a>
      </footer>
    </div>
  );
}
