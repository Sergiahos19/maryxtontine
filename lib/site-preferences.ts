import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "maryx-theme-v1";
const THEME_CHANGE_EVENT = "maryx-theme-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useThemePreference() {
  return useSyncExternalStore<ThemeMode>(subscribe, getThemePreference, () => "dark");
}

export function getThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  }
}

export function setThemePreference(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée) : le thème s’applique pour cette page uniquement.
  }
  document.documentElement.classList.toggle("light", theme === "light");
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
