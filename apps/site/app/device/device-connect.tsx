"use client";

import { useState } from "react";

export default function DeviceConnect({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<"idle" | "loading" | "approved" | "error">("idle");

  async function approve() {
    setStatus("loading");
    const response = await fetch("/api/device-auth/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode: code }),
    });
    setStatus(response.ok ? "approved" : "error");
  }

  if (status === "approved") {
    return (
      <div className="device-success" role="status">
        <strong>Fling is connected</strong>
        <span>You can close this window and return to the desktop app.</span>
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
        onClick={() => void approve()}
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
