"use client";

import { useEffect, useState } from "react";
import { getStoredTheme, resolveDark, setThemePersisted } from "@/lib/theme";

/**
 * Sidebar quick-toggle for the overhaul shell — a binary light/dark flip that
 * delegates to the shared theme module (`@/lib/theme`) so it stays in sync with
 * the Settings → Appearance control (Light / Dark / System). Toggling here sets
 * an explicit light/dark (overriding "system"), which is the expected behaviour
 * for a one-tap switch.
 */
export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(resolveDark(getStoredTheme()));
    sync();
    window.addEventListener("primy:themechange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("primy:themechange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = () => {
    setThemePersisted(resolveDark(getStoredTheme()) ? "light" : "dark");
  };

  return [dark, toggle];
}
