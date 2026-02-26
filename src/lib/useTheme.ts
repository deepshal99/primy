"use client";

import { useState, useEffect, useCallback } from "react";
import { ThemeMode, getStoredTheme, setStoredTheme, applyTheme, getResolvedTheme } from "./theme";

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Initialize from localStorage
  useEffect(() => {
    const stored = getStoredTheme();
    setModeState(stored);
    setResolved(getResolvedTheme(stored));
    applyTheme(stored);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const r = getResolvedTheme("system");
        setResolved(r);
        applyTheme("system");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setResolved(getResolvedTheme(newMode));
    setStoredTheme(newMode);
  }, []);

  return { mode, resolved, setMode };
}
