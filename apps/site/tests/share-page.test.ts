import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharePage from "@/app/s/[publicId]/page";

const { auth, findUnique } = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { capture: { findUnique } } }));

// React 18 exposes cache through Next's server runtime rather than Node's React entry.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (read: unknown) => read,
}));

const publicId = "public-video";

function renderShare() {
  return SharePage({ params: Promise.resolve({ publicId }) }).then(renderToStaticMarkup);
}

describe("public video share navigation", () => {
  beforeEach(() => {
    findUnique.mockResolvedValue({
      publicId,
      type: "VIDEO",
      title: "Demo.webm",
      mimeType: "video/webm",
      byteSize: BigInt(2048),
      expiresAt: null,
      createdAt: new Date("2026-01-01"),
    });
  });

  it("shows the library link in a signed-in browser", async () => {
    auth.mockResolvedValue({ user: { id: "viewer" } });
    const html = await renderShare();

    expect(html).toContain('<a href="/dashboard">Library</a>');
    expect(html).not.toContain("Log in");
    expect(html).toContain(`src="/api/captures/${publicId}/content"`);
  });

  it("plays publicly and returns to the video after sign-in", async () => {
    auth.mockResolvedValue(null);
    const html = await renderShare();

    expect(html).toContain(`<a href="/login?callbackUrl=%2Fs%2F${publicId}">Log in</a>`);
    expect(html).not.toContain('href="/dashboard"');
    expect(html).toContain(`src="/api/captures/${publicId}/content"`);
  });
});
