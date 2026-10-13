"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetupAdminPage() {
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/setup/status")
      .then((response) => response.json() as Promise<{ needsAdminSetup: boolean }>)
      .then((result) => setAvailable(result.needsAdminSetup))
      .catch(() => {
        setAvailable(false);
        setError("Impossible de vérifier l’état de la base.");
      });
  }, []);

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

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "La création du compte administrateur a échoué.");
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Le service d’initialisation est inaccessible.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,#020817,#0f172a_45%,#111827)] px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">MARYX</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Initialiser l’administration</h1>
          <p className="mt-3 text-sm text-slate-400">Créez votre propre compte. Aucun mot de passe par défaut n’est fourni.</p>
        </div>
        {available === false ? (
          <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Cette initialisation est réservée au premier démarrage local. En production, créez le premier administrateur avec l’outil serveur.
          </p>
        ) : available === null ? (
          <p className="text-center text-slate-400">Vérification de la base de données...</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Prénom" name="firstName" required />
              <Input label="Nom" name="lastName" required />
            </div>
            <Input label="Email" type="email" name="email" placeholder="nom@exemple.com" required />
            <Input label="Téléphone" type="tel" name="phone" placeholder="Numéro de téléphone" required />
            <Input label="Mot de passe (12 caractères minimum)" type="password" name="password" required />
            {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
            <Button className="w-full" variant="primary" type="submit" disabled={busy}>
              {busy ? "Création..." : "Créer mon compte administrateur"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
