import { auth } from "@/auth";
import { getSafeCallbackUrl } from "@/lib/safe-redirect";
import { Brand } from "../components/logo";
import { redirect } from "next/navigation";
import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Where to send the user after login. Local paths only, else /dashboard.
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(params.callbackUrl);
  const session = await auth();

  // Already signed in: skip the login page.
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="app">
      <header className="site-header">
        <Brand />
      </header>

      <main className="auth-shell">
        <section className="auth-panel reveal" aria-labelledby="login-title">
          <div>
            <p className="eyebrow">
              OAuth access
            </p>
            <h1 id="login-title">Continue with Google</h1>
            <p className="auth-copy">
              Use your Gmail account to open your capture library, manage links,
              and keep every shared screen moment organized.
            </p>
          </div>

          <div className="oauth-card">
            <GoogleButton redirectTo={callbackUrl} />
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
