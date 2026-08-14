import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const captures = await prisma.capture.findMany({
    where: { UserId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      publicId: true,
      type: true,
      title: true,
      mimeType: true,
      byteSize: true,
      durationMs: true,
      expiresAt: true,
    },
  });

  return (
    <DashboardClient
      initialCaptures={captures.map((capture) => ({
        ...capture,
        type: capture.type === "VIDEO" ? "video" : "image",
        byteSize: Number(capture.byteSize),
        expiresAt: capture.expiresAt?.toISOString() ?? null,
      }))}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}
