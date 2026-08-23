import { createSecret, hashSecret } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { readSmallJsonObject } from "@/lib/request-body";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await readSmallJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (
    typeof body.deviceCode !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(body.deviceCode)
  ) {
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

  const userId = authorization.UserId;
  const accessToken = createSecret(48);
  let issued = false;
  await prisma.$transaction(async (transaction) => {
    const consumption = await transaction.deviceAuthorization.updateMany({
      where: {
        id: authorization.id,
        UserId: userId,
        approvedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumption.count !== 1) return;

    await transaction.deviceToken.create({
      data: {
        UserId: userId,
        tokenHash: hashSecret(accessToken),
        name: authorization.deviceName || "Fling desktop",
      },
    });
    issued = true;
  });

  if (!issued) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  return NextResponse.json(
    {
      accessToken,
      tokenType: "Bearer",
      user: authorization.User,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
