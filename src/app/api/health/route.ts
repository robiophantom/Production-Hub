import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.query("select 1");
    return NextResponse.json({
      status: "ok",
      database: db.mode,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "error", message: "Database unavailable" }, { status: 503 });
  }
}
