import type { ThemeConfig } from "@/lib/types";

// Re-export ThemeConfig for backward compat — canonical definition lives in @/lib/types
export type { ThemeConfig };

export const deckThemes: Record<string, ThemeConfig> = {
  // ── Warm startup energy — inspired by Airbnb/Zapier ──
  pitch: {
    label: "Pitch",
    bg: "#FFFFFF",
    text: "#1A1A2E",
    textSecondary: "#6B6B80",
    accent: "#FF4A00",
    accentAlt: "#FF6B2C",
    accentLight: "rgba(255,74,0,0.07)",
    headingFont: "'Degular', 'Inter', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#FAFAFA",
    cardBorder: "#F0F0F0",
    divider: "#E8E8E8",
    bulletStyle: "bar",
    decorStyle: "minimal",
    googleFonts: ["Inter"],
  },

  // ── Ultra-minimal dark — inspired by Linear ──
  linear: {
    label: "Linear",
    bg: "#0A0A0B",
    text: "#EDEDEF",
    textSecondary: "rgba(237,237,239,0.55)",
    accent: "#5E6AD2",
    accentAlt: "#8087E8",
    accentLight: "rgba(94,106,210,0.10)",
    headingFont: "'Inter', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 600,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.06)",
    divider: "rgba(255,255,255,0.08)",
    bulletStyle: "dash",
    decorStyle: "gradient",
    googleFonts: ["Inter"],
  },

  // ── Premium corporate — inspired by Perplexity/Stripe ──
  executive: {
    label: "Executive",
    bg: "#FFFFFF",
    text: "#0A2540",
    textSecondary: "#425466",
    accent: "#0A2540",
    accentAlt: "#1A3A5C",
    accentLight: "rgba(10,37,64,0.05)",
    headingFont: "'Instrument Serif', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 400,
    headingCase: "none",
    cardBg: "#F6F9FC",
    cardBorder: "#E3E8EE",
    divider: "#E3E8EE",
    bulletStyle: "number",
    decorStyle: "minimal",
    googleFonts: ["Instrument Serif", "Inter"],
  },

  // ── High-contrast dark tech — inspired by Bolt/Zendesk ──
  bold: {
    label: "Bold",
    bg: "#111111",
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.60)",
    accent: "#34D186",
    accentAlt: "#5EEAA0",
    accentLight: "rgba(52,209,134,0.10)",
    headingFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(255,255,255,0.08)",
    divider: "rgba(255,255,255,0.10)",
    bulletStyle: "arrow",
    decorStyle: "gradient",
    googleFonts: ["Space Grotesk", "DM Sans"],
  },

  // ── Literary elegance — inspired by Mailchimp/Medium ──
  editorial: {
    label: "Editorial",
    bg: "#FAF9F7",
    text: "#1A1A1A",
    textSecondary: "#6B6B6B",
    accent: "#C53030",
    accentAlt: "#E53E3E",
    accentLight: "rgba(197,48,48,0.06)",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Source Serif 4', Georgia, serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#E8E5E0",
    divider: "#D6D3CE",
    bulletStyle: "dash",
    decorStyle: "geometric",
    googleFonts: ["Playfair Display", "Source Serif 4"],
  },

  // ── Clean, confident — inspired by Apple keynote ──
  arctic: {
    label: "Arctic",
    bg: "#F5F5F7",
    text: "#1D1D1F",
    textSecondary: "#6E6E73",
    accent: "#0071E3",
    accentAlt: "#2997FF",
    accentLight: "rgba(0,113,227,0.06)",
    headingFont: "'Inter', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#D2D2D7",
    divider: "#D2D2D7",
    bulletStyle: "disc",
    decorStyle: "minimal",
    googleFonts: ["Inter"],
  },

  // ── Organic warmth — inspired by nature/sustainability ──
  earth: {
    label: "Earth",
    bg: "#FAFAF5",
    text: "#1B3A2D",
    textSecondary: "#5C7A6B",
    accent: "#2D6A4F",
    accentAlt: "#40916C",
    accentLight: "rgba(45,106,79,0.06)",
    headingFont: "'DM Serif Display', Georgia, serif",
    bodyFont: "'Nunito Sans', system-ui, sans-serif",
    headingWeight: 400,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#DDE5DF",
    divider: "#C8D5CD",
    bulletStyle: "check",
    decorStyle: "geometric",
    googleFonts: ["DM Serif Display", "Nunito Sans"],
  },

  // ── Stark contrast — minimal/portfolio ──
  monochrome: {
    label: "Monochrome",
    bg: "#FFFFFF",
    text: "#111111",
    textSecondary: "#666666",
    accent: "#111111",
    accentAlt: "#333333",
    accentLight: "rgba(17,17,17,0.05)",
    headingFont: "'Bebas Neue', Impact, sans-serif",
    bodyFont: "'Roboto', system-ui, sans-serif",
    headingWeight: 400,
    headingCase: "uppercase",
    cardBg: "#F8F8F8",
    cardBorder: "#E0E0E0",
    divider: "#D0D0D0",
    bulletStyle: "bar",
    decorStyle: "minimal",
    googleFonts: ["Bebas Neue", "Roboto"],
  },
};

// Legacy theme mapping — old themes resolve to closest new equivalent
const legacyThemeMap: Record<string, string> = {
  light: "pitch",
  dark: "linear",
  gradient: "bold",
  minimal: "arctic",
  corporate: "executive",
  startup: "pitch",
  neon: "linear",
  sunset: "bold",
  slate: "executive",
  coral: "editorial",
  ocean: "arctic",
  forest: "earth",
};

/** Resolve any theme name (including legacy) to a valid theme key */
export function resolveTheme(theme: string): string {
  if (theme in deckThemes) return theme;
  return legacyThemeMap[theme] || "pitch";
}

/** Get theme config, resolving legacy names automatically */
export function getThemeConfig(theme: string): ThemeConfig {
  return deckThemes[resolveTheme(theme)];
}

/** The 8 active theme keys shown in the theme picker */
export const activeThemeKeys = [
  "pitch", "linear", "executive", "bold",
  "editorial", "arctic", "earth", "monochrome",
] as const;

// Dynamic Google Fonts loader
const loadedFonts = new Set<string>();

export function loadThemeFonts(theme: string) {
  const config = getThemeConfig(theme);
  loadThemeFontsFromConfig(config);
}

/** Load Google Fonts for a given ThemeConfig (works with custom AI-generated styles) */
export function loadThemeFontsFromConfig(config: ThemeConfig) {
  const toLoad = config.googleFonts.filter((f) => !loadedFonts.has(f));
  if (toLoad.length === 0) return;
  toLoad.forEach((f) => loadedFonts.add(f));
  const params = toLoad
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800;900`)
    .join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`;
  document.head.appendChild(link);
}

/** Resolve the effective ThemeConfig: custom style takes priority, then theme name, then "pitch" fallback */
export function resolveStyle(style?: ThemeConfig | null, theme?: string): ThemeConfig {
  if (style) return style;
  return getThemeConfig(theme || "pitch");
}
