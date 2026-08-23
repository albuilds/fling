import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function createSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createUserCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function authenticateDevice(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/i)?.[1];
  if (!token) return null;

  return prisma.deviceToken.findFirst({
    where: { tokenHash: hashSecret(token), revokedAt: null },
  });
}
