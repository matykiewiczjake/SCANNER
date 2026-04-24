import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented yet. Phase 2." },
    { status: 501 }
  );
}
