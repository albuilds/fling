import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { userCode?: unknown };
  const userCode =
    typeof body.userCode === "string" ? body.userCode.trim().toUpperCase() : "";
  const authorization = await prisma.deviceAuthorization.findUnique({
    where: { userCode },
  });

  if (!authorization || authorization.expiresAt <= new Date() || authorization.consumedAt) {
    return NextResponse.json({ error: "invalid_or_expired_code" }, { status: 400 });
  }

  await prisma.deviceAuthorization.update({
    where: { id: authorization.id },
    data: { UserId: session.user.id, approvedAt: new Date() },
  });

  return NextResponse.json({ approved: true, deviceName: authorization.deviceName });
}
