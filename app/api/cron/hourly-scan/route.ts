import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, note: "Wired up in Phase 5." });
}
