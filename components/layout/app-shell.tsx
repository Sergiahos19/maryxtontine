"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, History, LayoutGrid, LogOut, UserRound, UsersRound, WalletCards } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar } from "@/components/ui/avatar";

export type SessionUser = { id: string; firstName: string; lastName: string; email: string; role: "ADMIN" | "MEMBER"; avatarUrl: string | null };

const SessionContext = createContext<{ user: SessionUser; update: (changes: Partial<SessionUser>) => void } | null>(null);

export function useSessionUser() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSessionUser doit être utilisé dans AppShell.");
  return session.user;
}

/** Met à jour l’utilisateur affiché (photo, nom) sans recharger la page. */
export function useUpdateSessionUser() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useUpdateSessionUser doit être utilisé dans AppShell.");
  return session.update;
}

type AppShellProps = {
  children: React.ReactNode;
  /** Rôle requis : les autres sont redirigés vers leur propre espace. */
  access?: "member" | "admin" | "any";
};

export function AppShell({ children, access = "any" }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() as { user: SessionUser | null } : { user: null }))
      .then(({ user: sessionUser }) => {
        if (!active) return;
        if (!sessionUser) {
          router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (access === "member" && sessionUser.role === "ADMIN") {
          router.replace("/admin");
          return;
        }
        if (access === "admin" && sessionUser.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        setUser(sessionUser);
      })
      .catch(() => {
        if (active) router.replace("/auth/signin");
      });
    return () => { active = false; };
  }, [access, pathname, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function loadUnreadCount() {
      try {
        const response = await fetch("/api/notifications?summary=1", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { unreadCount?: number };
        if (active) setUnreadCount(Math.max(0, Number(result.unreadCount ?? 0)));
      } catch {
        // Le compteur reste à sa dernière valeur connue.
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
  }, [user]);

  async function signOut() {
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("La déconnexion a échoué. Réessayez.");
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
        <span className="sr-only">Chargement de votre espace</span>
      </div>
    );
  }

  const homeHref = user.role === "ADMIN" ? "/admin" : "/dashboard";
  const navItems = [
    ...(user.role === "ADMIN"
      ? [{ label: "Gestion", href: "/admin", icon: LayoutGrid }]
      : [{ label: "Solde", href: "/dashboard", icon: WalletCards }, { label: "Membres", href: "/dashboard/members", icon: UsersRound }]),
    { label: "Historique", href: "/history", icon: History },
    { label: "Alertes", href: "/notifications", icon: Bell, badge: unreadCount },
    { label: "Profil", href: "/account", icon: UserRound },
  ];
  // « Solde » (/dashboard) n’est actif que sur sa propre page, pas sur /dashboard/members.
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <SessionContext.Provider value={{ user, update: (changes) => setUser((current) => (current ? { ...current, ...changes } : current)) }}>
      <div className="min-h-dvh pb-28 md:pb-10">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <BrandMark href={homeHref} />
            <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`relative rounded-full px-3.5 py-2 text-sm font-medium ${isActive(item.href) ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
                >
                  {item.label}
                  {item.badge ? <span className="ml-1.5 rounded-full bg-bad px-1.5 py-0.5 text-[10px] font-bold text-white tabular">{item.badge > 99 ? "99+" : item.badge}</span> : null}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link href="/account" className="rounded-full p-0.5 hover:ring-2 hover:ring-accent/40" aria-label="Mon profil" title="Mon profil">
                <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="sm" />
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          {signOutError ? <p role="alert" className="px-4 pb-2 text-center text-xs text-bad">{signOutError}</p> : null}
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-8">{children}</main>

        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto max-w-md rounded-[1.75rem] border border-line bg-surface/90 shadow-[var(--shadow-float)] backdrop-blur-xl md:hidden"
        >
          <ul className={`grid px-1 py-1 ${navItems.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
            {navItems.map(({ label, href, icon: Icon, badge }) => {
              const current = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${current ? "text-accent" : "text-muted"}`}
                  >
                    <span className={`relative flex h-8 w-12 items-center justify-center rounded-full ${current ? "bg-accent-soft" : ""}`}>
                      <Icon className="h-5 w-5" />
                      {badge ? (
                        <span className="absolute -top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold leading-none text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </SessionContext.Provider>
  );
}

export function PageHeading({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-heading sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
