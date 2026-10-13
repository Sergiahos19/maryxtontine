"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || !payload.password) {
      setError("Tous les champs sont obligatoires.");
      return;
    }

    if (payload.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "La création du compte a échoué.");
        return;
      }
      setError("");
      router.replace("/auth/signin?created=1");
    } catch {
      setError("Le service d'inscription est inaccessible. Réessayez dans quelques instants.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,#020817,#0f172a_45%,#111827)] px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">MARYX</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Créer un compte</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Prénom" name="firstName" placeholder="Prénom" required />
            <Input label="Nom" name="lastName" placeholder="Nom" required />
          </div>
          <Input label="Email" type="email" name="email" placeholder="nom@exemple.com" required />
          <Input label="Téléphone" type="tel" name="phone" placeholder="Numéro de téléphone" required />
          <Input label="Mot de passe" type="password" name="password" placeholder="••••••••" required />

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <Button className="w-full" variant="primary" type="submit">Créer mon compte</Button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
          Vous avez déjà un compte ? <Link href="/auth/signin" className="text-cyan-300 hover:text-cyan-200">Connexion</Link>
        </div>
      </div>
    </main>
  );
}
