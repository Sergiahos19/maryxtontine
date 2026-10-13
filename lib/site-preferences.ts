import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "maryx-theme-v1";
const THEME_CHANGE_EVENT = "maryx-theme-change";

function subscribe(eventName: string, onStoreChange: () => void) {
  window.addEventListener(eventName, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(eventName, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useThemePreference() {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(THEME_CHANGE_EVENT, onStoreChange),
    getThemePreference,
    () => "dark",
  );
}

export function getThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function setThemePreference(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

