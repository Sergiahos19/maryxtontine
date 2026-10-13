"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

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
      setError("Le service d’initialisation ne répond pas.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Initialiser l’administration" description="Créez votre compte administrateur. Aucun mot de passe par défaut n’existe.">
      {available === false ? (
        <Notice tone="warning">
          L’initialisation n’est possible qu’au premier démarrage local. En production, créez l’administrateur avec la commande serveur.
        </Notice>
      ) : available === null ? (
        <p className="text-muted">Vérification de la base de données...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" name="firstName" autoComplete="given-name" required />
            <Input label="Nom" name="lastName" autoComplete="family-name" required />
          </div>
          <Input label="Téléphone" type="tel" name="phone" autoComplete="tel" inputMode="tel" required />
          <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" required />
          <Input label="Mot de passe" type="password" name="password" autoComplete="new-password" hint="12 caractères minimum." required />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button type="submit" block disabled={busy}>{busy ? "Création..." : "Créer le compte administrateur"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
