import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { deviceToken: { findFirst } },
}));

const { authenticateDevice, getBearerToken } = await import("@/lib/device-auth");
const { hashSecret } = await import("@/lib/secrets");

const TOKEN = "a".repeat(64);

function requestWith(authorization?: string) {
  return new Request("http://localhost/api/captures", {
    headers: authorization ? { authorization } : {},
  });
}

describe("getBearerToken", () => {
  it("extracts the token", () => {
    expect(getBearerToken(requestWith(`Bearer ${TOKEN}`))).toBe(TOKEN);
  });

  it.each([
    ["missing header", undefined],
    ["wrong scheme", `Basic ${TOKEN}`],
    ["too short", "Bearer abc"],
    ["invalid characters", `Bearer ${"a".repeat(40)}!`],
  ])("returns null for a %s", (_label, header) => {
    expect(getBearerToken(requestWith(header))).toBeNull();
  });
});

describe("authenticateDevice", () => {
  beforeEach(() => findFirst.mockReset());

  it("looks the token up by its hash and skips revoked tokens", async () => {
    const device = { id: "device-1", UserId: "user-1" };
    findFirst.mockResolvedValue(device);

    await expect(authenticateDevice(requestWith(`Bearer ${TOKEN}`))).resolves.toBe(device);
    expect(findFirst).toHaveBeenCalledWith({
      where: { tokenHash: hashSecret(TOKEN), revokedAt: null },
    });
  });

  it("does not query the database without a token", async () => {
    await expect(authenticateDevice(requestWith())).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
