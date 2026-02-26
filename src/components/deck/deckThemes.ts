import { DeckTheme } from "@/lib/types";

export interface ThemeConfig {
  bg: string;
  text: string;
  accent: string;
  accentAlt: string;
  subtitle: string;
  font: string;
  headingFont: string;
  label: string;
  // Decorative elements
  decorBg: string;      // secondary decorative color
  decorShape: string;   // tertiary shape color (low opacity)
  cardBg: string;       // card/container background
  cardBorder: string;   // card border
  divider: string;      // divider/line color
  slideNumber: string;  // slide number color
  bulletStyle: "disc" | "dash" | "number" | "arrow" | "check";
}

export const deckThemes: Record<DeckTheme, ThemeConfig> = {
  light: {
    bg: "#FFFFFF",
    text: "#111111",
    accent: "#2563EB",
    accentAlt: "#3B82F6",
    subtitle: "#64748B",
    font: "'Inter', system-ui, sans-serif",
    headingFont: "'Inter', system-ui, sans-serif",
    label: "Light",
    decorBg: "#F1F5F9",
    decorShape: "rgba(37, 99, 235, 0.06)",
    cardBg: "#F8FAFC",
    cardBorder: "#E2E8F0",
    divider: "#E2E8F0",
    slideNumber: "#CBD5E1",
    bulletStyle: "disc",
  },
  dark: {
    bg: "#0F172A",
    text: "#F8FAFC",
    accent: "#38BDF8",
    accentAlt: "#818CF8",
    subtitle: "#94A3B8",
    font: "'Inter', system-ui, sans-serif",
    headingFont: "'Inter', system-ui, sans-serif",
    label: "Dark",
    decorBg: "#1E293B",
    decorShape: "rgba(56, 189, 248, 0.08)",
    cardBg: "rgba(30, 41, 59, 0.7)",
    cardBorder: "rgba(51, 65, 85, 0.6)",
    divider: "#334155",
    slideNumber: "#475569",
    bulletStyle: "dash",
  },
  gradient: {
    bg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
    text: "#FFFFFF",
    accent: "#A78BFA",
    accentAlt: "#C084FC",
    subtitle: "rgba(255,255,255,0.7)",
    font: "'Inter', system-ui, sans-serif",
    headingFont: "'Inter', system-ui, sans-serif",
    label: "Gradient",
    decorBg: "rgba(255,255,255,0.05)",
    decorShape: "rgba(167, 139, 250, 0.12)",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.1)",
    divider: "rgba(255,255,255,0.12)",
    slideNumber: "rgba(255,255,255,0.25)",
    bulletStyle: "arrow",
  },
  minimal: {
    bg: "#FAF9F7",
    text: "#1C1917",
    accent: "#D97706",
    accentAlt: "#EA580C",
    subtitle: "#78716C",
    font: "'Georgia', 'Times New Roman', serif",
    headingFont: "'Georgia', 'Times New Roman', serif",
    label: "Minimal",
    decorBg: "#F5F5F4",
    decorShape: "rgba(217, 119, 6, 0.06)",
    cardBg: "#FFFFFF",
    cardBorder: "#E7E5E4",
    divider: "#D6D3D1",
    slideNumber: "#A8A29E",
    bulletStyle: "number",
  },
  corporate: {
    bg: "#FFFFFF",
    text: "#1E293B",
    accent: "#0F766E",
    accentAlt: "#0D9488",
    subtitle: "#64748B",
    font: "'Inter', system-ui, sans-serif",
    headingFont: "'Inter', system-ui, sans-serif",
    label: "Corporate",
    decorBg: "#F0FDFA",
    decorShape: "rgba(15, 118, 110, 0.05)",
    cardBg: "#F8FAFC",
    cardBorder: "#E2E8F0",
    divider: "#CBD5E1",
    slideNumber: "#94A3B8",
    bulletStyle: "check",
  },
};
