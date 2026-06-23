import {
  ArrowRight,
  Check,
  Clipboard,
  Cloud,
  Download,
  Film,
  MonitorUp,
  MousePointer2,
  Play,
  Sparkles,
  TimerReset,
  Zap,
} from "lucide-react";

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
    body: "Use the same overlay model for short, focused screen recordings.",
  },
];

const previewSections = [
  {
    icon: Sparkles,
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
        title: "Record video / GIF",
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
        body: "Keep screenshots and recordings on this PC",
        control: "toggle",
        enabled: true,
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

function Logo() {
  return (
    <span className="logo" aria-label="Fling">
      <Zap size={18} strokeWidth={2.5} />
    </span>
  );
}

function ProductScene() {
  return (
    <div className="scene reveal" aria-hidden="true">
      <div className="scene-window">
        <div className="scene-titlebar">
          <div className="scene-brand">
            <Logo />
            <span>Fling</span>
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
                      <Icon size={14} />
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
              <span className="footer-action ghost">Reset defaults</span>
              <span className="footer-action primary">Save settings</span>
            </div>
          </div>

          <div className="overlay-preview">
            <div className="scene-hint">Drag to select a screenshot area</div>
            <div className="capture-region">
              <span className="crosshair horizontal" />
              <span className="crosshair vertical" />
            </div>
            <div className="capture-toolbar">
              <span className="option active">Copy</span>
              <span className="option active">Save</span>
              <span className="option disabled">Upload</span>
              <span className="primary-action">Screenshot</span>
              <span className="ghost-action">Cancel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Fling home">
          <Logo />
          <span>Fling</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="#workflow">Workflow</a>
          <a href="#capture">Capture</a>
          <a href="#download">Download</a>
        </nav>
        <a className="header-action" href="#download">
          <Download size={16} />
          <span>Get Fling</span>
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-layout">
            <div className="hero-content reveal">
              <p className="eyebrow">
                <MonitorUp size={14} />
                Screen capture for fast-moving work
              </p>
              <h1 id="hero-title">Fling</h1>
              <p className="hero-copy">
                Capture screenshots, record focused clips, and keep every share
                moving without breaking concentration.
              </p>
              <div className="hero-actions" aria-label="Primary actions">
                <a className="button primary" href="#download">
                  <Download size={18} />
                  <span>Download app</span>
                </a>
                <a className="button secondary" href="#workflow">
                  <Play size={18} />
                  <span>See workflow</span>
                </a>
              </div>
              <div className="hero-proof" aria-label="Product qualities">
                <span>
                  <Sparkles size={14} />
                  Native desktop feel
                </span>
                <span>
                  <TimerReset size={14} />
                  Low-friction handoff
                </span>
              </div>
            </div>
            <ProductScene />
          </div>
          <div className="hero-stats reveal" aria-label="Highlights">
            <div>
              <strong>Region</strong>
              <span>Screenshot selection</span>
            </div>
            <div>
              <strong>Video</strong>
              <span>Timed recordings</span>
            </div>
            <div>
              <strong>Local</strong>
              <span>Clipboard and files</span>
            </div>
          </div>
        </section>

        <section className="workflow reveal" id="workflow" aria-labelledby="workflow-title">
          <div className="section-heading reveal">
            <p className="eyebrow">
              <TimerReset size={14} />
              Built around one clean motion
            </p>
            <h2 id="workflow-title">Capture, decide, move on.</h2>
          </div>
          <div className="workflow-grid">
            {workflowItems.map((item) => {
              const Icon = item.icon;
              return (
                <article className="feature-card reveal" key={item.title}>
                  <div className="feature-icon">
                    <Icon size={20} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="capture-band reveal" id="capture" aria-labelledby="capture-title">
          <div className="capture-copy reveal">
            <p className="eyebrow">
              <Cloud size={14} />
              Ready for local-first sharing
            </p>
            <h2 id="capture-title">A desktop utility with web-ready momentum.</h2>
            <p>
              Fling keeps capture controls compact and predictable while leaving
              room for upload, browser handoff, and link workflows as the app grows.
            </p>
          </div>
          <div className="capability-list">
            {[
              "Keyboard-friendly screenshot and record overlays",
              "Save locally or copy output without extra prompts",
              "Settings that match real capture habits",
            ].map((item) => (
              <div className="capability reveal" key={item}>
                <Check size={17} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="download reveal" id="download" aria-labelledby="download-title">
          <div>
            <p className="eyebrow">
              <Zap size={14} />
              Start with the desktop app
            </p>
            <h2 id="download-title">Fast capture, polished controls, no ceremony.</h2>
          </div>
          <a className="button primary" href="#">
            <ArrowRight size={18} />
            <span>Prepare download</span>
          </a>
        </section>
      </main>
    </div>
  );
}
