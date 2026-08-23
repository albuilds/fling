import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.deviceToken.update({
    where: { id: device.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ revoked: true });
}
