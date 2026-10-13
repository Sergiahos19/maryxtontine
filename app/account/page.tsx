"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccountProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; profile?: AccountProfile };
        if (response.status === 401) {
          router.replace("/auth/signin");
          return;
        }
        if (!response.ok || !result.profile) {
          setProfileError(result.error ?? "Impossible de charger votre profil.");
          return;
        }
        setProfile(result.profile);
      })
      .catch(() => setProfileError("Le service de données est inaccessible."))
      .finally(() => setLoading(false));
  }, [router]);

  async function onProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProfileError("");
    setProfileSuccess("");
    setProfileBusy(true);
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
        setProfileError(result.error ?? "La mise à jour du profil a échoué.");
        return;
      }
      setProfile(result.profile);
      setProfileSuccess("Vos informations ont été mises à jour.");
      router.refresh();
    } catch {
      setProfileError("Le service de données est inaccessible. Réessayez.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function onPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmation) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setPasswordBusy(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        setPasswordError(result.error ?? "Le mot de passe n’a pas pu être modifié.");
        return;
      }
      formElement.reset();
      setPasswordSuccess(result.message ?? "Votre mot de passe a été modifié.");
    } catch {
      setPasswordError("Le service de données est inaccessible. Réessayez.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Mon compte</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Informations personnelles</h1>
        </div>
        {loading ? <p className="text-slate-400">Chargement...</p> : null}
        {profileError ? <p role="alert" className="mb-5 text-sm text-red-300">{profileError}</p> : null}
        {profile ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-xl font-semibold text-white">Coordonnées</h2>
              <form onSubmit={onProfileSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Prénom" name="firstName" value={profile.firstName} required />
                  <Input label="Nom" name="lastName" value={profile.lastName} required />
                </div>
                <Input label="Email" type="email" name="email" value={profile.email} required />
                <Input label="Téléphone" type="tel" name="phone" value={profile.phone} required />
                {profileSuccess ? <p role="status" className="text-sm text-emerald-300">{profileSuccess}</p> : null}
                <Button type="submit" disabled={profileBusy}>{profileBusy ? "Enregistrement..." : "Enregistrer mes informations"}</Button>
              </form>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-xl font-semibold text-white">Modifier le mot de passe</h2>
              <form onSubmit={onPasswordSubmit} className="mt-5 space-y-4">
                <Input label="Mot de passe actuel" type="password" name="currentPassword" required />
                <Input label="Nouveau mot de passe (12 caractères minimum)" type="password" name="newPassword" required />
                <Input label="Confirmer le nouveau mot de passe" type="password" name="confirmation" required />
                {passwordError ? <p role="alert" className="text-sm text-red-300">{passwordError}</p> : null}
                {passwordSuccess ? <p role="status" className="text-sm text-emerald-300">{passwordSuccess}</p> : null}
                <Button type="submit" disabled={passwordBusy}>{passwordBusy ? "Modification..." : "Modifier le mot de passe"}</Button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}