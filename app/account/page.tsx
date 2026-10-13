"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell, PageHeading, useSessionUser, useUpdateSessionUser } from "@/components/layout/app-shell";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";

type AccountProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MEMBER";
};

type Feedback = { tone: "success" | "error"; text: string } | null;

export default function AccountPage() {
  return (
    <AppShell>
      <Account />
    </AppShell>
  );
}

function Account() {
  const router = useRouter();
  const sessionUser = useSessionUser();
  const updateSessionUser = useUpdateSessionUser();
  const [photoFeedback, setPhotoFeedback] = useState<Feedback>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    void fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; profile?: AccountProfile };
        if (!response.ok || !result.profile) setLoadError(result.error ?? "Impossible de charger votre profil.");
        else setProfile(result.profile);
      })
      .catch(() => setLoadError("Le service est inaccessible."));
  }, []);

  async function onProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileFeedback(null);
    setBusy("profile");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
      });
      const result = await response.json() as { error?: string; profile?: AccountProfile };
      if (!response.ok || !result.profile) {
        setProfileFeedback({ tone: "error", text: result.error ?? "La mise à jour a échoué." });
        return;
      }
      setProfile(result.profile);
      setProfileFeedback({ tone: "success", text: "Informations enregistrées." });
    } catch {
      setProfileFeedback({ tone: "error", text: "Le service est inaccessible. Réessayez." });
    } finally {
      setBusy("");
    }
  }

  async function onPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    setPasswordFeedback(null);
    if (newPassword !== String(form.get("confirmation") ?? "")) {
      setPasswordFeedback({ tone: "error", text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setBusy("password");
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: String(form.get("currentPassword") ?? ""), newPassword }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        setPasswordFeedback({ tone: "error", text: result.error ?? "Le mot de passe n’a pas pu être modifié." });
        return;
      }
      formElement.reset();
      setPasswordFeedback({ tone: "success", text: result.message ?? "Mot de passe modifié." });
    } catch {
      setPasswordFeedback({ tone: "error", text: "Le service est inaccessible. Réessayez." });
    } finally {
      setBusy("");
    }
  }

  async function onPhotoChange(dataUrl: string | null) {
    setPhotoFeedback(null);
    setBusy("photo");
    try {
      const response = await fetch("/api/account/avatar", {
        method: dataUrl ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: dataUrl ? JSON.stringify({ avatar: dataUrl }) : undefined,
      });
      const result = await response.json() as { error?: string; avatarUrl?: string | null };
      if (!response.ok) {
        setPhotoFeedback({ tone: "error", text: result.error ?? "La photo n’a pas pu être enregistrée." });
        return;
      }
      updateSessionUser({ avatarUrl: result.avatarUrl ?? null });
      setPhotoFeedback({ tone: "success", text: dataUrl ? "Photo enregistrée." : "Photo retirée." });
    } catch {
      setPhotoFeedback({ tone: "error", text: "Le service est inaccessible. Réessayez." });
    } finally {
      setBusy("");
    }
  }

  async function signOut() {
    setBusy("signout");
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      setBusy("");
    }
  }

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!profile) return <p className="py-16 text-center text-muted">Chargement...</p>;

  const minLength = profile.role === "ADMIN" ? 12 : 8;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeading title="Profil" description={`${profile.firstName} ${profile.lastName}, ${profile.role === "ADMIN" ? "administrateur" : "membre"}.`} />

      <Panel title="Photo de profil">
        <AvatarPicker
          value={sessionUser.avatarUrl}
          onChange={(dataUrl) => void onPhotoChange(dataUrl)}
          initials={`${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()}
          disabled={busy === "photo"}
          label={busy === "photo" ? "Enregistrement..." : "Votre photo"}
        />
        {photoFeedback ? <Notice tone={photoFeedback.tone} className="mt-4">{photoFeedback.text}</Notice> : null}
      </Panel>

      <Panel title="Coordonnées">
        <form onSubmit={onProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" name="firstName" value={profile.firstName} autoComplete="given-name" required />
            <Input label="Nom" name="lastName" value={profile.lastName} autoComplete="family-name" required />
          </div>
          <Input label="Téléphone" type="tel" name="phone" value={profile.phone} autoComplete="tel" inputMode="tel" required />
          <Input label="Email" type="email" name="email" value={profile.email} autoComplete="email" inputMode="email" required />
          {profileFeedback ? <Notice tone={profileFeedback.tone}>{profileFeedback.text}</Notice> : null}
          <Button type="submit" block disabled={busy === "profile"}>{busy === "profile" ? "Enregistrement..." : "Enregistrer"}</Button>
        </form>
      </Panel>

      <Panel title="Mot de passe" description="Les autres appareils connectés seront déconnectés.">
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <Input label="Mot de passe actuel" type="password" name="currentPassword" autoComplete="current-password" required />
          <Input label="Nouveau mot de passe" type="password" name="newPassword" autoComplete="new-password" minLength={minLength} hint={`${minLength} caractères minimum.`} required />
          <Input label="Confirmer le nouveau mot de passe" type="password" name="confirmation" autoComplete="new-password" required />
          {passwordFeedback ? <Notice tone={passwordFeedback.tone}>{passwordFeedback.text}</Notice> : null}
          <Button type="submit" variant="secondary" block disabled={busy === "password"}>{busy === "password" ? "Modification..." : "Changer le mot de passe"}</Button>
        </form>
      </Panel>

      <Button variant="danger" block onClick={() => void signOut()} disabled={busy === "signout"}>
        <LogOut className="h-4 w-4" /> Se déconnecter
      </Button>
    </div>
  );
}
