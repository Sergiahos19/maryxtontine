import { NextResponse, type NextRequest } from "next/server";

import { publicUser } from "@/lib/database";
import { getAuthenticatedUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  return NextResponse.json({ user: user ? publicUser(user) : null }, { headers: { "Cache-Control": "private, no-store" } });
}
