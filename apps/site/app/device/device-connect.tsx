"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

export default function DeviceConnect({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<"idle" | "loading" | "approved" | "error">("idle");
  const normalizedCode = code.trim().toUpperCase();
  const hasCompleteCode = /^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/.test(
    normalizedCode,
  );

  async function approve(requestedCode = code) {
    if (status === "loading") return;
    setStatus("loading");
    const response = await fetch("/api/device-auth/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode: requestedCode.trim().toUpperCase() }),
    });
    setStatus(response.ok ? "approved" : "error");
  }

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

  return (
    <div className="device-form">
      <label htmlFor="device-code">Confirm the code shown in the Fling app</label>
      <input
        id="device-code"
        autoComplete="one-time-code"
        maxLength={9}
        onChange={(event) => {
          setCode(event.target.value.toUpperCase());
          if (status === "error") setStatus("idle");
        }}
        placeholder="ABCD-EFGH"
        value={code}
      />
      <button
        className="button primary"
        disabled={status === "loading" || !hasCompleteCode}
        onClick={() => void approve(code)}
        type="button"
      >
        {status === "loading" ? (
          <>
            <LoaderCircle className="device-spinner" size={18} />
            Connecting...
          </>
        ) : (
          "Connect device"
        )}
      </button>
      {status === "error" ? (
        <p className="device-error" role="alert">That code is invalid or has expired.</p>
      ) : null}
    </div>
  );
}
