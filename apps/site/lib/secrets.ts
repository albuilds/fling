import { createHash, randomBytes } from "node:crypto";

// Letters and digits that are hard to confuse when read aloud or typed
// (no O/0 or I/1). 32 characters divides 256 evenly, so mapping random bytes
// with `% 32` does not bias any character.
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/**
 * Hashes a high-entropy secret (device code or access token) for storage.
 * A fast hash is fine here because the input is random, not a password.
 */
export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** Returns a URL-safe random secret. 32 bytes = 256 bits of entropy. */
export function createSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Returns an unguessable public identifier for share links. Anyone who knows
 * the link can view the capture, so the ID has to work like a password:
 * 16 random bytes = 128 bits, encoded as 22 URL-safe characters.
 */
export function createShareId() {
  return randomBytes(16).toString("base64url");
}

/** Returns a short code such as `ABCD-EFGH` for the user to confirm. */
export function createUserCode() {
  const bytes = randomBytes(8);
  const code = Array.from(
    bytes,
    (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length],
  ).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalizes user input like `abcd efgh` or `ABCDEFGH` to `ABCD-EFGH`.
 * Returns null when the input cannot be a valid user code.
 */
export function normalizeUserCode(value: unknown) {
  if (typeof value !== "string") return null;
  const compact = value.toUpperCase().replace(/[-\s]/g, "");
  if (!USER_CODE_PATTERN.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}
