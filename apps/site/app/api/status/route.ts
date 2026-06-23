import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ name: "fling-site", status: "ok" });
}
