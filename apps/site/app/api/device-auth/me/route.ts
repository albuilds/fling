import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: device.UserId },
    select: { id: true, name: true, email: true, image: true },
  });
  return NextResponse.json({ user, device: { id: device.id, name: device.name } });
}
