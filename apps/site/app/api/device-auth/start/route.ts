import { getAppOrigin } from "@/lib/app-url";
import { createSecret, createUserCode, hashSecret } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { readSmallJsonObject } from "@/lib/request-body";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await readSmallJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const requestedDeviceName =
    typeof body.deviceName === "string"
      ? body.deviceName.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80)
      : "";
  const deviceName = requestedDeviceName || null;
  const deviceCode = createSecret();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let userCode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    userCode = createUserCode();
    try {
      await prisma.deviceAuthorization.create({
        data: { deviceCodeHash: hashSecret(deviceCode), userCode, deviceName, expiresAt },
      });
      break;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "P2002") throw error;
      userCode = "";
    }
  }

  if (!userCode) {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const origin = getAppOrigin(request.url);
  return NextResponse.json(
    {
      deviceCode,
      userCode,
      verificationUri: `${origin}/device`,
      verificationUriComplete: `${origin}/device?code=${encodeURIComponent(userCode)}`,
      expiresIn: 600,
      interval: 3,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
