import { NextResponse } from "next/server";

import { database } from "@/lib/database";

export const runtime = "nodejs";

export function GET() {
  const adminExists = Boolean(database.prepare("select 1 from users where role = 'ADMIN' limit 1").get());
  return NextResponse.json({ needsAdminSetup: !adminExists && process.env.NODE_ENV !== "production" });
}
