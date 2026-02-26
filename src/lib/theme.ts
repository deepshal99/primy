/**
 * Theme management — read/write preference, detect system preference, apply data-theme.
 * The design tokens in design.ts stay as the "light" values for SSR/build.
 * Runtime theming is done via CSS variables in globals.css (see [data-theme="dark"]).
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "drafta-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system";
}

export function setStoredTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}

export function getResolvedTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = getResolvedTheme(mode);
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Returns the dark-mode-aware design tokens.
 * Components that need runtime theme values should read CSS variables via
 * var(--color-*) in their styles. This function provides a JS-accessible
 * way to get the resolved CSS variable values.
 */
export function getCSSVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
