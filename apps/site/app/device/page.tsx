import { auth } from "@/auth";
import { MonitorUp } from "lucide-react";
import { Brand } from "../components/logo";
import { redirect } from "next/navigation";
import DeviceConnect from "./device-connect";

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.slice(0, 9) : "";
  const session = await auth();

  if (!session?.user) {
    const returnTo = `/device${code ? `?code=${encodeURIComponent(code)}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div className="app">
      <header className="site-header">
        <Brand />
      </header>
      <main className="auth-shell device-shell">
        <section className="auth-panel reveal" aria-labelledby="device-title">
          <div>
            <p className="eyebrow">
              <MonitorUp size={14} />
              Desktop authorization
            </p>
            <h1 id="device-title">Connect your Fling app</h1>
            <p className="auth-copy">
              Confirm that the code below matches your desktop before connecting it to
              your account.
            </p>
          </div>
          <DeviceConnect initialCode={code.toUpperCase()} />
        </section>
      </main>
    </div>
  );
}
