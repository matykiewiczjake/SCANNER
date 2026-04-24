import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      database: !!process.env.DATABASE_URL,
      helius: !!process.env.HELIUS_API_KEY,
      birdeye: !!process.env.BIRDEYE_API_KEY,
      lunarcrush: !!process.env.LUNARCRUSH_API_KEY,
      cron: !!process.env.CRON_SECRET,
      password: !!process.env.DASHBOARD_PASSWORD,
    },
  });
}
