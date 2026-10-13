"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, MoonStar, SunMedium, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { setThemePreference, useThemePreference } from "@/lib/site-preferences";

export function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const theme = useThemePreference();
  const [sessionUser, setSessionUser] = useState<{ firstName: string; lastName: string; role: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { user: { firstName: string; lastName: string; role: string } };
      })
      .then((result) => {
        if (active) setSessionUser(result?.user ?? null);
      })
      .catch(() => {
        if (active) setSessionUser(null);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      return;
    }
    let active = true;
    async function loadUnreadCount() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { unreadCount?: number };
        if (active) setUnreadCount(Math.max(0, Number(result.unreadCount ?? 0)));
      } catch {
        if (active) setUnreadCount(0);
      }
    }
    void loadUnreadCount();
    window.addEventListener("maryx-notifications-change", loadUnreadCount);
    const interval = window.setInterval(() => void loadUnreadCount(), 30_000);
    return () => {
      active = false;
      window.removeEventListener("maryx-notifications-change", loadUnreadCount);
      window.clearInterval(interval);
    };
  }, [sessionUser]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemePreference(next);
  };
  const profileLabel = sessionUser ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim() : "";
  const profileInitials = sessionUser ? `${sessionUser.firstName[0] ?? ""}${sessionUser.lastName[0] ?? ""}`.toUpperCase() : "";
  const navItems = [
    { label: "Tableau de bord", href: "/dashboard" },
    { label: "Cotisations", href: "/dashboard" },
    { label: "Paiements", href: "/dashboard" },
    { label: "Historique", href: "/history" },
    { label: "Membres", href: "/dashboard/members" },
    { label: "Notifications", href: "/notifications" },
  ];

  async function signOut() {
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) {
        setActionError("La déconnexion a échoué. Réessayez.");
        return;
      }
    } catch {
      setActionError("Le service de déconnexion est inaccessible. Réessayez.");
      return;
    }
    setSessionUser(null);
    setUnreadCount(0);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 text-slate-100 backdrop-blur-xl dark:bg-slate-950/80 dark:text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
              <Image src="/images/maryxok.jpeg" alt="MARYX" fill sizes="44px" className="object-cover" priority />
            </div>
            <span className="text-lg font-semibold tracking-[0.25em] text-slate-100">MARYX</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          {sessionUser ? navItems.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href} className="transition hover:text-cyan-300">
              {item.label}
            </Link>
          )) : null}
        </nav>

        <div className="flex items-center gap-3">
          {sessionUser ? (
            <Link href="/account" className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200" aria-label="Mon profil" title="Mon profil">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">Mon profil</span>
            </Link>
          ) : null}
          {sessionUser ? (
            <Link
              href="/notifications"
              className="relative rounded-full border border-white/10 bg-slate-900 p-2 text-slate-300"
              aria-label={unreadCount ? `Notifications, ${unreadCount} non lues` : "Notifications"}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-950">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <button
            className="rounded-full border border-white/10 bg-slate-900 p-2 text-slate-300"
            aria-label="Changer de thème"
            aria-pressed={theme === "light"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>
          {sessionUser ? (
            <button onClick={signOut} className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 md:px-4" aria-label="Se déconnecter">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                {profileInitials}
              </span>
              <span className="hidden sm:inline">{profileLabel}</span>
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/auth/signin" className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 md:px-4">
              <span>Connexion</span>
            </Link>
          )}
          <button
            className="inline-flex rounded-full border border-white/10 bg-slate-900 p-2 text-slate-300 md:hidden"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-slate-950/95 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-slate-200">
            {sessionUser ? navItems.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className="rounded-lg px-3 py-2 hover:bg-slate-900" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            )) : null}
          </nav>
        </div>
      ) : null}
      {actionError ? <p role="alert" className="mx-auto max-w-7xl px-4 pb-2 text-right text-xs text-red-300">{actionError}</p> : null}
    </header>
  );
}
