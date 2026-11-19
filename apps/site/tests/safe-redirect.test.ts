import { describe, expect, it } from "vitest";
import { getSafeCallbackUrl } from "@/lib/safe-redirect";

describe("getSafeCallbackUrl", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/device?code=ABCD-EFGH", "/device?code=ABCD-EFGH"],
    ["/dashboard#recent", "/dashboard#recent"],
    ["/a/../dashboard", "/dashboard"],
  ])("allows the same-site path %j", (input, expected) => {
    expect(getSafeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative URL", "//evil.example/phish"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "dashboard"],
  ])("falls back to /dashboard for a %s", (_label, input) => {
    expect(getSafeCallbackUrl(input)).toBe("/dashboard");
  });
});
