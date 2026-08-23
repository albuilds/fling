"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function DeviceConnect({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const hasCompleteCode = initialCode.trim().length >= 8;
  const [status, setStatus] = useState<"idle" | "loading" | "approved" | "error">(
    hasCompleteCode ? "loading" : "idle",
  );
  const autoConnectStarted = useRef(false);

  async function approve(requestedCode = code) {
    setStatus("loading");
    const response = await fetch("/api/device-auth/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode: requestedCode }),
    });
    setStatus(response.ok ? "approved" : "error");
  }

  useEffect(() => {
    if (!hasCompleteCode || autoConnectStarted.current) return;
    autoConnectStarted.current = true;
    void approve(initialCode);
  }, [hasCompleteCode, initialCode]);

  if (status === "approved") {
    return (
      <div className="device-success" role="status">
        <span className="device-status-icon success">
          <Check size={22} strokeWidth={2.5} />
        </span>
        <strong>Fling is connected</strong>
        <span>Your desktop app will continue automatically. You can close this window.</span>
      </div>
    );
  }

  if (hasCompleteCode) {
    return (
      <div className="device-waiting" role={status === "error" ? "alert" : "status"}>
        <span className="device-status-icon">
          <LoaderCircle className={status === "loading" ? "device-spinner" : ""} size={22} />
        </span>
        <span className="device-code-label">Desktop code</span>
        <strong className="device-code">{initialCode}</strong>
        {status === "loading" ? (
          <span>Securely connecting your desktop…</span>
        ) : (
          <>
            <span className="device-error">That code is invalid or has expired.</span>
            <button className="button primary" onClick={() => void approve(initialCode)} type="button">
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="device-form">
      <label htmlFor="device-code">Code shown in the Fling app</label>
      <input
        id="device-code"
        autoComplete="one-time-code"
        maxLength={9}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="ABCD-EFGH"
        value={code}
      />
      <button
        className="button primary"
        disabled={status === "loading" || code.trim().length < 8}
        onClick={() => void approve(code)}
        type="button"
      >
        {status === "loading" ? "Connecting..." : "Connect device"}
      </button>
      {status === "error" ? (
        <p className="device-error" role="alert">That code is invalid or has expired.</p>
      ) : null}
    </div>
  );
}
