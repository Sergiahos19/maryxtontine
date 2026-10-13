import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json(
    { error: "La récupération par email nécessite la configuration d’un service d’envoi. Contactez l’administrateur pour réinitialiser le compte." },
    { status: 503 },
  );
}
