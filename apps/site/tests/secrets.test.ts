import { describe, expect, it } from "vitest";
import {
  createSecret,
  createShareId,
  createUserCode,
  hashSecret,
  normalizeUserCode,
} from "@/lib/secrets";

describe("hashSecret", () => {
  it("returns the SHA-256 hex digest", () => {
    expect(hashSecret("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("never returns the secret itself", () => {
    const secret = createSecret();
    expect(hashSecret(secret)).not.toContain(secret);
  });
});

describe("createSecret", () => {
  it("encodes 32 random bytes as 43 URL-safe characters", () => {
    expect(createSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("does not repeat", () => {
    const secrets = new Set(Array.from({ length: 1000 }, () => createSecret()));
    expect(secrets.size).toBe(1000);
  });
});

describe("createShareId", () => {
  it("encodes 128 random bits as 22 URL-safe characters", () => {
    expect(createShareId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createShareId()));
    expect(ids.size).toBe(1000);
  });
});

describe("createUserCode", () => {
  it("uses the XXXX-XXXX format without look-alike characters", () => {
    for (let i = 0; i < 1000; i += 1) {
      expect(createUserCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });
});

describe("normalizeUserCode", () => {
  it.each([
    ["ABCD-EFGH", "ABCD-EFGH"],
    ["abcd-efgh", "ABCD-EFGH"],
    ["ABCDEFGH", "ABCD-EFGH"],
    [" abcd efgh ", "ABCD-EFGH"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeUserCode(input)).toBe(expected);
  });

  it.each([
    ["too short", "ABCD-EFG"],
    ["too long", "ABCD-EFGHJ"],
    ["look-alike O", "ABCD-EFGO"],
    ["look-alike 1", "ABCD-EFG1"],
    ["symbols", "ABCD-EF$H"],
    ["not a string", 12345678],
    ["missing", undefined],
  ])("rejects %s", (_label, input) => {
    expect(normalizeUserCode(input)).toBeNull();
  });
});
