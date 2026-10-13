"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLink, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Le jeton est retiré de la barre d’adresse pour ne pas rester dans l’historique.
    const value = new URLSearchParams(window.location.search).get("token") ?? "";
    window.history.replaceState(null, "", "/auth/reset-password");
    const timeout = window.setTimeout(() => setToken(value), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmation") ?? "")) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Le mot de passe n’a pas pu être modifié.");
        setBusy(false);
        return;
      }
      router.replace("/auth/signin?reset=1");
    } catch {
      setError("Le service ne répond pas. Vérifiez votre connexion internet.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      description="Choisissez un mot de passe d’au moins 8 caractères."
      footer={<AuthLink href="/auth/signin">Retour à la connexion</AuthLink>}
    >
      {token === "" ? (
        <Notice tone="error">
          Ce lien est incomplet. <AuthLink href="/auth/forgot-password">Faites une nouvelle demande</AuthLink>.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Nouveau mot de passe" type="password" name="password" autoComplete="new-password" minLength={8} required />
          <Input label="Confirmer le mot de passe" type="password" name="confirmation" autoComplete="new-password" required />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button type="submit" block disabled={busy || token === null}>{busy ? "Enregistrement..." : "Enregistrer le mot de passe"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
