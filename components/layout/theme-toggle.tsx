"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { setThemePreference, useThemePreference } from "@/lib/site-preferences";

export function ThemeToggle({ className = "text-muted hover:bg-surface-2 hover:text-ink" }: { className?: string }) {
  const theme = useThemePreference();
  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${className}`}
      aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
      onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <SunMedium className="h-[18px] w-[18px]" /> : <MoonStar className="h-[18px] w-[18px]" />}
    </button>
  );
}
