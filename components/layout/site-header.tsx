"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonClass } from "@/components/ui/button";

/** `onBrand` : posé sur le bandeau sombre de l’accueil, sans fond propre. */
export function SiteHeader({ onBrand = false }: { onBrand?: boolean }) {
  const [spaceHref, setSpaceHref] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() as { user: { role: string } | null } : { user: null }))
      .then(({ user }) => {
        if (active && user) setSpaceHref(user.role === "ADMIN" ? "/admin" : "/dashboard");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <header className={onBrand ? "relative z-10" : "sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl"}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <BrandMark textClassName={onBrand ? "text-maryx-ice" : undefined} />
        <div className="flex items-center gap-1.5">
          <ThemeToggle className={onBrand ? "text-maryx-ice/80 hover:bg-white/10 hover:text-white" : undefined} />
          {onBrand ? (
            <Link href={spaceHref ?? "/auth/signin"} className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10">
              {spaceHref ? "Mon espace" : "Se connecter"}
            </Link>
          ) : spaceHref ? (
            <Link href={spaceHref} className={buttonClass({ size: "sm" })}>Mon espace</Link>
          ) : (
            <Link href="/auth/signin" className={buttonClass({ variant: "secondary", size: "sm" })}>Se connecter</Link>
          )}
        </div>
      </div>
    </header>
  );
}
