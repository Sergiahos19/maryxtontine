"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) return;
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "La réinitialisation n'est pas disponible.");
      } else {
        setError("");
        setSent(true);
      }
    } catch {
      setError("Le service de récupération est inaccessible. Réessayez dans quelques instants.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,#020817,#0f172a_45%,#111827)] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">MARYX</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Mot de passe oublié</h1>
        </div>

        {!sent ? (
          <form onSubmit={onSubmit} className="space-y-5">
            <Input label="Email" type="email" name="email" placeholder="nom@exemple.com" required />
            {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
            <Button className="w-full" variant="primary" type="submit">Envoyer le lien</Button>
          </form>
        ) : (
          <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Si cette adresse est associée à un compte, un lien de réinitialisation sera envoyé.
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
          <Link href="/auth/signin" className="text-cyan-300 hover:text-cyan-200">Retour à la connexion</Link>
        </div>
      </div>
    </main>
  );
}
