import { NextResponse } from "next/server";

import { db } from "@/lib/database";

export const runtime = "nodejs";

export async function GET() {
  const adminExists = Boolean(await db.get("select 1 from users where role = 'ADMIN' limit 1"));
  return NextResponse.json({ needsAdminSetup: !adminExists && process.env.NODE_ENV !== "production" });
}
