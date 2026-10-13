"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLink, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

/** N’accepte qu’un chemin interne pour éviter toute redirection vers un autre site. */
function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/auth") ? value : null;
}

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("created") === "1"
      ? "Votre compte est créé. Connectez-vous pour commencer."
      : params.get("reset") === "1" ? "Mot de passe modifié. Connectez-vous avec le nouveau." : "";
    if (message) {
      const timeout = window.setTimeout(() => setNotice(message), 0);
      return () => window.clearTimeout(timeout);
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setError("Renseignez votre email et votre mot de passe.");
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
        setError(result.error ?? "Connexion impossible. Vérifiez vos identifiants.");
        setBusy(false);
        return;
      }
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next ?? (result.user.role === "ADMIN" ? "/admin" : "/dashboard"));
      router.refresh();
    } catch {
      setError("Le service de connexion ne répond pas. Vérifiez votre connexion internet.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Connexion"
      description="Retrouvez votre solde, vos cotisations et vos reçus."
      footer={<>Pas encore membre ? <AuthLink href="/auth/signup">Créer un compte</AuthLink><SetupAdminLink /></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="nom@exemple.com" required />
        <Input label="Mot de passe" type="password" name="password" autoComplete="current-password" required />
        <div className="flex justify-end">
          <AuthLink href="/auth/forgot-password">Mot de passe oublié ?</AuthLink>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" block disabled={busy}>{busy ? "Connexion..." : "Se connecter"}</Button>
      </form>
    </AuthShell>
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
  return <p className="mt-3"><AuthLink href="/auth/setup-admin">Initialiser le compte administrateur</AuthLink></p>;
}
