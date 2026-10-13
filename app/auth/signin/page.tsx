"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("created") === "1") {
      const timeout = window.setTimeout(() => {
        setSuccess("Votre compte a été créé. Connectez-vous avec votre email et votre mot de passe.");
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string; user?: { role: "ADMIN" | "MEMBER" } };
      if (!response.ok || !result.user) {
        setError(result.error ?? "Connexion impossible. Vérifiez vos identifiants et réessayez.");
        setBusy(false);
        return;
      }

      router.replace(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Le service de connexion est inaccessible. Réessayez dans quelques instants.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,#020817,#0f172a_45%,#111827)] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">MARYX</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Connexion</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <Input label="Email" type="email" name="email" placeholder="nom@exemple.com" required />
          <Input label="Mot de passe" type="password" name="password" placeholder="••••••••" required />

          {success ? <p role="status" className="text-sm text-emerald-300">{success}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex items-center justify-between text-sm text-slate-400">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-white/10 bg-slate-950" />
              Se souvenir de moi
            </label>
            <Link href="/auth/forgot-password" className="text-cyan-300 hover:text-cyan-200">Mot de passe oublié ?</Link>
          </div>

          <Button className="w-full" variant="primary" type="submit" disabled={busy}>
            {busy ? "Connexion en cours..." : "Se connecter"}
          </Button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
          Pas encore inscrit ? <Link href="/auth/signup" className="text-cyan-300 hover:text-cyan-200">Créer un compte</Link>
        </div>
        <SetupAdminLink />
      </div>
    </main>
  );
}

function SetupAdminLink() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void fetch("/api/setup/status")
      .then((response) => response.json() as Promise<{ needsAdminSetup: boolean }>)
      .then((result) => setAvailable(result.needsAdminSetup))
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;
  return (
    <div className="mt-4 text-center text-sm">
      <Link href="/auth/setup-admin" className="text-amber-300 hover:text-amber-200">Initialiser le compte administrateur</Link>
    </div>
  );
}
