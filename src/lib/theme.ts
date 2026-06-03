"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Theme control — Light / Dark / System.
 *
 * One storage key (`primy:theme`) holds `"light" | "dark" | "system"`. The
 * resolved mode drives the `.dark` class on <html> (the token block in
 * globals.css). An anti-FOUC inline script in `layout.tsx` applies the resolved
 * class before first paint; this module keeps it in sync at runtime.
 *
 * `setThemePersisted` is the single writer: it persists, re-applies the class,
 * and broadcasts `primy:themechange` so every theme-aware hook (the Settings
 * control AND the sidebar quick-toggle) updates live without a remount.
 */

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "primy:theme";
const CHANGE_EVENT = "primy:themechange";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function resolveDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark());
}

export function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

/** The single writer: persist + apply + broadcast. */
export function setThemePersisted(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  applyThemeClass(theme);
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/** Full theme control for the Settings UI: light | dark | system. */
export function useTheme(): {
  theme: Theme;
  resolvedDark: boolean;
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>("light");

  // Hydrate from storage on mount.
  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  // Stay in sync with the sidebar quick-toggle / other tabs, and (while in
  // "system" mode) with the OS preference.
  useEffect(() => {
    const sync = () => setThemeState(getStoredTheme());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => {
      if (getStoredTheme() === "system") applyThemeClass("system");
    };
    mq.addEventListener("change", onMedia);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      mq.removeEventListener("change", onMedia);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setThemePersisted(t);
  }, []);

  return { theme, resolvedDark: resolveDark(theme), setTheme };
}
