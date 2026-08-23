import { createSecret, createUserCode, hashSecret } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { deviceName?: unknown };
  const deviceName =
    typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 80) : null;
  const deviceCode = createSecret();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let userCode = createUserCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const exists = await prisma.deviceAuthorization.findUnique({ where: { userCode } });
    if (!exists) break;
    userCode = createUserCode();
  }

  await prisma.deviceAuthorization.create({
    data: { deviceCodeHash: hashSecret(deviceCode), userCode, deviceName, expiresAt },
  });

  const origin = process.env.APP_BASE_URL || new URL(request.url).origin;
  return NextResponse.json({
    deviceCode,
    userCode,
    verificationUri: `${origin}/device`,
    verificationUriComplete: `${origin}/device?code=${encodeURIComponent(userCode)}`,
    expiresIn: 600,
    interval: 3,
  });
}
