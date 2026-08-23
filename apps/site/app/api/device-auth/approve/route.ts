import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readSmallJsonObject } from "@/lib/request-body";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readSmallJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_or_expired_code" }, { status: 400 });
  }
  const compactCode =
    typeof body.userCode === "string"
      ? body.userCode.toUpperCase().replace(/[-\s]/g, "")
      : "";
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(compactCode)) {
    return NextResponse.json({ error: "invalid_or_expired_code" }, { status: 400 });
  }

  const userCode = `${compactCode.slice(0, 4)}-${compactCode.slice(4)}`;
  const authorization = await prisma.deviceAuthorization.findUnique({
    where: { userCode },
  });

  if (!authorization || authorization.expiresAt <= new Date() || authorization.consumedAt) {
    return NextResponse.json({ error: "invalid_or_expired_code" }, { status: 400 });
  }

  const approval = await prisma.deviceAuthorization.updateMany({
    where: {
      id: authorization.id,
      approvedAt: null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { UserId: session.user.id, approvedAt: new Date() },
  });
  if (approval.count !== 1) {
    return NextResponse.json({ error: "invalid_or_expired_code" }, { status: 400 });
  }

  return NextResponse.json(
    { approved: true, deviceName: authorization.deviceName },
    { headers: { "cache-control": "no-store" } },
  );
}
