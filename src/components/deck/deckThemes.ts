import { DeckTheme } from "@/lib/types";

export interface ThemeConfig {
  label: string;
  bg: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentAlt: string;
  accentLight: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  headingCase: "none" | "uppercase";
  cardBg: string;
  cardBorder: string;
  divider: string;
  bulletStyle: "disc" | "dash" | "number" | "arrow" | "check" | "ring" | "bar";
  decorStyle: "geometric" | "organic" | "minimal" | "gradient" | "dots" | "lines";
  googleFonts: string[];
}

export const deckThemes: Record<string, ThemeConfig> = {
  executive: {
    label: "Executive",
    bg: "#0B1120",
    text: "#F5F0E8",
    textSecondary: "rgba(245,240,232,0.6)",
    accent: "#C9A84C",
    accentAlt: "#E2C36B",
    accentLight: "rgba(201,168,76,0.12)",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Source Sans 3', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.08)",
    divider: "rgba(201,168,76,0.3)",
    bulletStyle: "bar",
    decorStyle: "lines",
    googleFonts: ["Playfair Display", "Source Sans 3"],
  },
  startup: {
    label: "Startup",
    bg: "#FFFFFF",
    text: "#0F172A",
    textSecondary: "#64748B",
    accent: "#4361EE",
    accentAlt: "#7C3AED",
    accentLight: "rgba(67,97,238,0.06)",
    headingFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#F8FAFC",
    cardBorder: "#E2E8F0",
    divider: "#E2E8F0",
    bulletStyle: "disc",
    decorStyle: "geometric",
    googleFonts: ["Space Grotesk", "Inter"],
  },
  editorial: {
    label: "Editorial",
    bg: "#FAFAF8",
    text: "#1A1A1A",
    textSecondary: "#6B6B6B",
    accent: "#BE123C",
    accentAlt: "#E11D48",
    accentLight: "rgba(190,18,60,0.06)",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingWeight: 600,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#E5E5E5",
    divider: "#D4D4D4",
    bulletStyle: "dash",
    decorStyle: "minimal",
    googleFonts: ["Cormorant Garamond", "Lato"],
  },
  neon: {
    label: "Neon",
    bg: "#0A0E1A",
    text: "#E8ECF4",
    textSecondary: "rgba(232,236,244,0.55)",
    accent: "#00D4FF",
    accentAlt: "#7B61FF",
    accentLight: "rgba(0,212,255,0.08)",
    headingFont: "'Outfit', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(0,212,255,0.12)",
    divider: "rgba(255,255,255,0.08)",
    bulletStyle: "arrow",
    decorStyle: "dots",
    googleFonts: ["Outfit", "DM Sans"],
  },
  earth: {
    label: "Earth",
    bg: "#F7F3ED",
    text: "#2C1810",
    textSecondary: "#7A6652",
    accent: "#8B6914",
    accentAlt: "#A67C2E",
    accentLight: "rgba(139,105,20,0.08)",
    headingFont: "'DM Serif Display', Georgia, serif",
    bodyFont: "'Nunito Sans', system-ui, sans-serif",
    headingWeight: 400,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#E8DFD1",
    divider: "#D4C8B5",
    bulletStyle: "disc",
    decorStyle: "organic",
    googleFonts: ["DM Serif Display", "Nunito Sans"],
  },
  arctic: {
    label: "Arctic",
    bg: "#F0F4F8",
    text: "#1B2A4A",
    textSecondary: "#5A6E8A",
    accent: "#2563EB",
    accentAlt: "#3B82F6",
    accentLight: "rgba(37,99,235,0.06)",
    headingFont: "'Montserrat', system-ui, sans-serif",
    bodyFont: "'Open Sans', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#D5DEE8",
    divider: "#CBD5E1",
    bulletStyle: "number",
    decorStyle: "geometric",
    googleFonts: ["Montserrat", "Open Sans"],
  },
  sunset: {
    label: "Sunset",
    bg: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #4a1942 100%)",
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.65)",
    accent: "#FF6B35",
    accentAlt: "#FF3CAC",
    accentLight: "rgba(255,107,53,0.15)",
    headingFont: "'Sora', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.1)",
    divider: "rgba(255,255,255,0.12)",
    bulletStyle: "arrow",
    decorStyle: "gradient",
    googleFonts: ["Sora", "Inter"],
  },
  monochrome: {
    label: "Monochrome",
    bg: "#000000",
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.55)",
    accent: "#FFFFFF",
    accentAlt: "#A0A0A0",
    accentLight: "rgba(255,255,255,0.06)",
    headingFont: "'Bebas Neue', Impact, sans-serif",
    bodyFont: "'Roboto', system-ui, sans-serif",
    headingWeight: 400,
    headingCase: "uppercase",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.12)",
    divider: "rgba(255,255,255,0.15)",
    bulletStyle: "bar",
    decorStyle: "minimal",
    googleFonts: ["Bebas Neue", "Roboto"],
  },
  ocean: {
    label: "Ocean",
    bg: "linear-gradient(180deg, #0c2340 0%, #163a5f 100%)",
    text: "#F0F8FF",
    textSecondary: "rgba(240,248,255,0.6)",
    accent: "#4DD0E1",
    accentAlt: "#26C6DA",
    accentLight: "rgba(77,208,225,0.1)",
    headingFont: "'Poppins', system-ui, sans-serif",
    bodyFont: "'Source Sans 3', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(77,208,225,0.15)",
    divider: "rgba(255,255,255,0.1)",
    bulletStyle: "disc",
    decorStyle: "organic",
    googleFonts: ["Poppins", "Source Sans 3"],
  },
  forest: {
    label: "Forest",
    bg: "#0D1F0D",
    text: "#E8F5E9",
    textSecondary: "rgba(232,245,233,0.55)",
    accent: "#66BB6A",
    accentAlt: "#81C784",
    accentLight: "rgba(102,187,106,0.1)",
    headingFont: "'Merriweather', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(102,187,106,0.15)",
    divider: "rgba(102,187,106,0.2)",
    bulletStyle: "check",
    decorStyle: "organic",
    googleFonts: ["Merriweather", "Lato"],
  },
  coral: {
    label: "Coral",
    bg: "#FFF5F5",
    text: "#2D1B1B",
    textSecondary: "#7A5A5A",
    accent: "#E8505B",
    accentAlt: "#F06292",
    accentLight: "rgba(232,80,91,0.06)",
    headingFont: "'Raleway', system-ui, sans-serif",
    bodyFont: "'Nunito', system-ui, sans-serif",
    headingWeight: 700,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#F5D5D5",
    divider: "#ECC8C8",
    bulletStyle: "ring",
    decorStyle: "geometric",
    googleFonts: ["Raleway", "Nunito"],
  },
  slate: {
    label: "Slate",
    bg: "#F8F9FA",
    text: "#212529",
    textSecondary: "#6C757D",
    accent: "#0F766E",
    accentAlt: "#0D9488",
    accentLight: "rgba(15,118,110,0.05)",
    headingFont: "'IBM Plex Sans', system-ui, sans-serif",
    bodyFont: "'IBM Plex Serif', Georgia, serif",
    headingWeight: 600,
    headingCase: "none",
    cardBg: "#FFFFFF",
    cardBorder: "#DEE2E6",
    divider: "#CED4DA",
    bulletStyle: "number",
    decorStyle: "lines",
    googleFonts: ["IBM Plex Sans", "IBM Plex Serif"],
  },
};

// Legacy theme mapping — old themes resolve to new equivalents
const legacyThemeMap: Record<string, string> = {
  light: "startup",
  dark: "neon",
  gradient: "sunset",
  minimal: "editorial",
  corporate: "slate",
};

/** Resolve any theme name (including legacy) to a valid theme key */
export function resolveTheme(theme: string): string {
  if (theme in deckThemes) return theme;
  return legacyThemeMap[theme] || "startup";
}

/** Get theme config, resolving legacy names automatically */
export function getThemeConfig(theme: string): ThemeConfig {
  return deckThemes[resolveTheme(theme)];
}

/** The 12 active theme keys shown in the theme picker */
export const activeThemeKeys = [
  "startup", "arctic", "slate", "editorial", "coral", "earth",
  "executive", "neon", "ocean", "forest", "sunset", "monochrome",
] as const;

// Dynamic Google Fonts loader
const loadedFonts = new Set<string>();

export function loadThemeFonts(theme: string) {
  const config = getThemeConfig(theme);
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
