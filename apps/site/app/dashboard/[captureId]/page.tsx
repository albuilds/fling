import {
  ArrowLeft,
  Copy,
  Download,
  Film,
  Link2,
  MoreHorizontal,
  TimerReset,
  Trash2,
  Zap,
} from "lucide-react";

function Logo() {
  return (
    <span className="logo" aria-label="Fling">
      <Zap size={18} strokeWidth={2.5} />
    </span>
  );
}

export default function CaptureDetailPage() {
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
              <Film size={14} />
              Video share
            </p>
            <h1>Product walkthrough</h1>
            <p>Uploaded today · 2:14 MP4 · 84 MB</p>
          </div>
        </section>

        <section className="detail-layout">
          <div className="media-stage reveal" aria-label="Video preview">
            <div className="video-frame">
              <div className="play-mark">
                <Film size={42} />
              </div>
              <div className="video-controlbar">
                <span>0:00</span>
                <i />
                <span>2:14</span>
              </div>
            </div>
          </div>

          <aside className="detail-panel reveal" aria-label="Video actions">
            <div className="expiry-box">
              <span>
                <TimerReset size={15} />
                Expires in
              </span>
              <strong>12h 48m</strong>
              <small>Links will stop working after expiration.</small>
            </div>

            <div className="share-link">
              <span>fling.app/s/product-walkthrough</span>
              <button type="button" aria-label="Copy share link">
                <Copy size={17} />
              </button>
            </div>

            <div className="action-list">
              <button className="button primary" type="button">
                <Copy size={18} />
                <span>Copy link</span>
              </button>
              <button className="button secondary" type="button">
                <Download size={18} />
                <span>Download</span>
              </button>
              <button className="button secondary" type="button">
                <Link2 size={18} />
                <span>Open share page</span>
              </button>
              <button className="button danger" type="button">
                <Trash2 size={18} />
                <span>Delete video</span>
              </button>
            </div>

            <div className="detail-meta">
              <div>
                <span>Views</span>
                <strong>18</strong>
              </div>
              <div>
                <span>Visibility</span>
                <strong>Unlisted</strong>
              </div>
              <button type="button" aria-label="More options">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
