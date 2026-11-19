import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/secrets";

const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9_-]{32,256})$/i;

/** Extracts the raw token from an `Authorization: Bearer ...` header. */
export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.match(BEARER_TOKEN_PATTERN)?.[1] ?? null;
}

/**
 * Looks up the desktop device that sent this request. Only the SHA-256 hash
 * of each token is stored, so the raw token is hashed before the lookup.
 */
export async function authenticateDevice(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  return prisma.deviceToken.findFirst({
    where: { tokenHash: hashSecret(token), revokedAt: null },
  });
}
