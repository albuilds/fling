import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppOrigin } from "@/lib/app-url";

describe("getAppOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers APP_BASE_URL over the request URL", () => {
    vi.stubEnv("APP_BASE_URL", "https://fling.example/some/path");
    expect(getAppOrigin("http://attacker.example/")).toBe("https://fling.example");
  });

  it("falls back to the request URL", () => {
    vi.stubEnv("APP_BASE_URL", "");
    expect(getAppOrigin("http://localhost:3000/api/captures")).toBe(
      "http://localhost:3000",
    );
  });

  it.each([
    ["a non-HTTP protocol", "ftp://fling.example"],
    ["embedded credentials", "https://user:pass@fling.example"],
  ])("rejects %s", (_label, url) => {
    vi.stubEnv("APP_BASE_URL", url);
    expect(() => getAppOrigin()).toThrow();
  });

  it("throws when nothing is configured", () => {
    vi.stubEnv("APP_BASE_URL", "");
    expect(() => getAppOrigin()).toThrow("APP_BASE_URL is not configured");
  });
});
