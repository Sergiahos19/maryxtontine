"use client";

import { useState } from "react";

import { AuthLink, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "unavailable">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setState("busy");
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { error?: string };
      if (response.status === 503) return setState("unavailable");
      if (!response.ok) {
        setError(result.error ?? "La demande n’a pas pu être envoyée.");
        return setState("idle");
      }
      setState("sent");
    } catch {
      setError("Le service ne répond pas. Vérifiez votre connexion internet.");
      setState("idle");
    }
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Recevez un lien par email pour choisir un nouveau mot de passe."
      footer={<AuthLink href="/auth/signin">Retour à la connexion</AuthLink>}
    >
      {state === "sent" ? (
        <Notice tone="success">
          Si cette adresse correspond à un compte, un lien valable une heure vient d’être envoyé. Pensez à vérifier vos courriers indésirables.
        </Notice>
      ) : state === "unavailable" ? (
        <div className="space-y-4">
          <Notice tone="warning">L’envoi d’emails n’est pas encore activé sur ce site.</Notice>
          <p className="text-ink">
            Demandez un mot de passe temporaire à l’administrateur de la tontine, puis choisissez-en un nouveau depuis votre profil.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Email du compte" type="email" name="email" autoComplete="email" inputMode="email" placeholder="nom@exemple.com" required />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button type="submit" block disabled={state === "busy"}>{state === "busy" ? "Envoi..." : "Recevoir le lien"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
