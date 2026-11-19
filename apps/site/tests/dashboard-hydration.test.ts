import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaptureDetailClient from "@/app/dashboard/[captureId]/capture-detail-client";
import DashboardClient from "@/app/dashboard/dashboard-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const initialNowMs = Date.parse("2026-11-19T00:00:00Z");
const capture = {
  id: "recording",
  publicId: "shared-recording",
  type: "video" as const,
  title: "Demo.webm",
  mimeType: "video/webm",
  byteSize: 2048,
  durationMs: 4000,
  expiresAt: "2026-11-19T01:00:00Z",
  createdAt: "2026-11-19T00:00:00Z",
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dashboard initial render", () => {
  it("keeps the library markup stable across countdown and expiration boundaries", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(initialNowMs);
    const render = () => renderToString(createElement(DashboardClient, {
      user: { name: "Fling tester" },
      initialCaptures: [capture],
      initialNowMs,
    }));

    const serverHtml = render();
    expect(serverHtml).toContain("1h");
    expect(serverHtml).toContain("<video");

    vi.setSystemTime(initialNowMs + 1000);
    expect(render()).toBe(serverHtml);
    vi.setSystemTime(initialNowMs + 3_600_000);
    expect(render()).toBe(serverHtml);
  });

  it("keeps upload dates and expiry actions stable across browser locales and clocks", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(initialNowMs);
    const formatDate = vi.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("11/19/2026");
    const render = () => renderToString(createElement(CaptureDetailClient, {
      capture,
      initialNowMs,
      initialUploadDate: "11/19/2026",
    }));

    const serverHtml = render();
    expect(serverHtml).toContain("Uploaded 11/19/2026");
    expect(serverHtml).toContain("Open share page");

    formatDate.mockReturnValue("18/11/2026");
    vi.setSystemTime(initialNowMs + 3_600_000);
    expect(render()).toBe(serverHtml);
  });
});
