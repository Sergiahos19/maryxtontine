"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { getThemePreference, setThemePreference } from "@/lib/site-preferences";

export function NavigationControls() {
  const router = useRouter();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    for (const key of ["maryx-state-v1", "maryx-state-v2", "maryx-session-v1", "maryx-session-v2"]) {
      window.localStorage.removeItem(key);
    }
    document.cookie = "maryx-role=; path=/; max-age=0";
    document.cookie = "maryx-session=; path=/; max-age=0";
    setThemePreference(getThemePreference());
    const updateScroll = () => setShowTop(window.scrollY > 240);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      <button
        type="button"
        aria-label="Retour à la page précédente"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/");
        }}
        className="rounded-full border border-white/10 bg-slate-900 p-3 text-slate-200 shadow-lg hover:bg-slate-800"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {showTop ? (
        <button
          type="button"
          aria-label="Retour en haut"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-full border border-cyan-400/30 bg-cyan-500 p-3 text-slate-950 shadow-lg hover:bg-cyan-400"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
