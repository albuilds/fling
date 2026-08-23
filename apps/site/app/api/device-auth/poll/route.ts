import { createSecret, hashSecret } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { deviceCode?: unknown };
  if (typeof body.deviceCode !== "string" || !body.deviceCode) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const authorization = await prisma.deviceAuthorization.findUnique({
    where: { deviceCodeHash: hashSecret(body.deviceCode) },
    include: { User: { select: { id: true, name: true, email: true, image: true } } },
  });

  if (!authorization || authorization.expiresAt <= new Date()) {
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }
  if (authorization.consumedAt) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (!authorization.UserId || !authorization.approvedAt || !authorization.User) {
    return NextResponse.json({ error: "authorization_pending" }, { status: 202 });
  }

  const accessToken = createSecret(48);
  await prisma.$transaction([
    prisma.deviceToken.create({
      data: {
        UserId: authorization.UserId,
        tokenHash: hashSecret(accessToken),
        name: authorization.deviceName || "Fling desktop",
      },
    }),
    prisma.deviceAuthorization.update({
      where: { id: authorization.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    accessToken,
    tokenType: "Bearer",
    user: authorization.User,
  });
}
