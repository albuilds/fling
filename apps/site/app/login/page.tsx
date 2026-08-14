import { auth } from "@/auth";
import { MonitorUp, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { GoogleButton } from "./google-button";

function Logo() {
  return (
    <span className="logo" aria-label="Fling">
      <Zap size={18} strokeWidth={2.5} />
    </span>
  );
}

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Fling home">
          <Logo />
          <span>Fling</span>
        </a>
      </header>

      <main className="auth-shell">
        <section className="auth-panel reveal" aria-labelledby="login-title">
          <div>
            <p className="eyebrow">
              <MonitorUp size={14} />
              OAuth access
            </p>
            <h1 id="login-title">Continue with Google</h1>
            <p className="auth-copy">
              Use your Gmail account to open your capture library, manage links,
              and keep every shared screen moment organized.
            </p>
          </div>

          <div className="oauth-card">
            <GoogleButton />
          </div>
        </section>

        <aside className="auth-preview reveal" aria-label="Account preview">
          <div className="mini-window">
            <div className="mini-titlebar">
              <span>Recent shares</span>
              <span>Live</span>
            </div>
            <div className="mini-capture video">
              <span>Product walkthrough.mp4</span>
              <strong>12:48 left</strong>
            </div>
            <div className="mini-capture image">
              <span>Checkout bug.png</span>
              <strong>2d left</strong>
            </div>
            <div className="mini-meter">
              <span>Total storage used</span>
              <strong>6.4 GB / 10 GB</strong>
              <i />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
