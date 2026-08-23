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
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  return prisma.deviceToken.findFirst({
    where: { tokenHash: hashSecret(token), revokedAt: null },
  });
}
