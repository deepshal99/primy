"use client";

import { useEffect, useState } from "react";

/**
 * Shell V2 flag — the Strut-inspired overhaul shell.
 *
 * Resolution order:
 *   1. URL param `?shell=v2` / `?shell=v1` (persisted to localStorage)
 *   2. localStorage `primy:shellV2`
 *   3. default → true (the overhaul is the product)
 *
 * Toggle live without a rebuild by visiting `/app?shell=v1` (legacy) or
 * `/app?shell=v2` (new). The choice sticks across navigations.
 */
const KEY = "primy:shellV2";

function readFlag(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Explicit URL override always wins (and sticks).
    const url = new URLSearchParams(window.location.search).get("shell");
    if (url === "v2") {
      window.localStorage.setItem(KEY, "1");
      return true;
    }
    if (url === "v1") {
      window.localStorage.setItem(KEY, "0");
      return false;
    }
    const stored = window.localStorage.getItem(KEY);
    if (stored === "0") return false;
    if (stored === "1" && window.innerWidth >= 768) return true;
    // Default: the overhaul shell is desktop-first (it docks a 232px sidebar +
    // 420px chat). Below md, fall back to the legacy shell which has a proper
    // mobile panel toggle — until V2 grows a responsive layout.
    return window.innerWidth >= 768;
  } catch {
    /* ignore */
  }
  return true;
}

export function useShellV2(): boolean {
  // Default true on the server and first client paint to avoid a flash of the
  // legacy shell; reconciled from URL/localStorage in the effect.
  const [v2, setV2] = useState(true);
  useEffect(() => {
    setV2(readFlag());
  }, []);
  return v2;
}

/**
 * Dark-mode toggle for the overhaul shell. Adds/removes `.dark` on
 * <html> (activating the `.dark` token block in globals.css) and persists.
 */
const THEME_KEY = "primy:theme";

export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      const isDark = stored === "dark";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return [dark, toggle];
}
