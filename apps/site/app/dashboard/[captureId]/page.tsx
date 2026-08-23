import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import CaptureDetailClient from "./capture-detail-client";

type CaptureDetailPageProps = {
  params: Promise<{ captureId: string }>;
};

export default async function CaptureDetailPage({ params }: CaptureDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { captureId } = await params;
  const capture = await prisma.capture.findFirst({
    where: { id: captureId, UserId: session.user.id },
    select: {
      id: true,
      publicId: true,
      type: true,
      title: true,
      mimeType: true,
      byteSize: true,
      durationMs: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!capture) notFound();

  return (
    <CaptureDetailClient
      capture={{
        ...capture,
        type: capture.type === "VIDEO" ? "video" : "image",
        byteSize: Number(capture.byteSize),
        expiresAt: capture.expiresAt?.toISOString() ?? null,
        createdAt: capture.createdAt.toISOString(),
      }}
    />
  );
}
