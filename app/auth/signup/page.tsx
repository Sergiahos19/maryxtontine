"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthLink, AuthShell } from "@/components/layout/auth-shell";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      avatar,
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || !payload.password) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (payload.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "La création du compte a échoué.");
        setBusy(false);
        return;
      }
      router.replace("/auth/signin?created=1");
    } catch {
      setError("Le service d’inscription ne répond pas. Vérifiez votre connexion internet.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Rejoindre la tontine"
      description="Votre dossier membre est créé dès l’inscription."
      footer={<>Déjà membre ? <AuthLink href="/auth/signin">Se connecter</AuthLink></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <AvatarPicker value={avatar} onChange={setAvatar} disabled={busy} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" name="firstName" autoComplete="given-name" required />
          <Input label="Nom" name="lastName" autoComplete="family-name" required />
        </div>
        <Input label="Téléphone" type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="+229 01 00 00 00 00" required />
        <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="nom@exemple.com" required />
        <Input label="Mot de passe" type="password" name="password" autoComplete="new-password" hint="8 caractères minimum." required />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" block disabled={busy}>{busy ? "Création..." : "Créer mon compte"}</Button>
      </form>
    </AuthShell>
  );
}
