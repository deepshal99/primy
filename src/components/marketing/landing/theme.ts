import { Inter, Inter_Tight } from "next/font/google";

/* Display = Inter Tight 500, tight leading/tracking. Body/UI = Inter.
   Marketing-only deviation, scoped to this preview. */
const displayFont = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const bodyFont = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const DISPLAY = displayFont.style.fontFamily;
export const BODY = bodyFont.style.fontFamily;

/* Primy color system (not the magicpath single-accent device):
   - ink is the primary action color (brand black)
   - blue is interactive (links, live things)
   - amber is the AI signal ONLY (cursor, thinking, send, memory)
   - entity colors are the lively layer, used contextually per section */
export const C = {
  white: "#FFFFFF",
  alt: "#FCFBF8",
  ink: "#171716",
  inkBtn: "#1A1815",
  inkBtnHover: "#33302B",
  body: "#3B3A37",
  muted: "#706E68",
  faint: "#B9B6AE",
  // AI signal
  amber: "#FFB43F",
  amberDeep: "#B87426",
  amberTint: "rgba(255,180,63,0.14)",
  // interactive
  blue: "#4285F4",
  blueTint: "rgba(66,133,244,0.08)",
  blueBorder: "rgba(66,133,244,0.22)",
  // entity + candy
  green: "#42C366",
  purple: "#8757D7",
  pink: "#F073A7",
  teal: "#67CEC8",
  // readable text variants on white (display sizes)
  blueText: "#3672DD",
  greenText: "#2E9E4F",
  amberText: "#C77E1F",
  purpleText: "#8757D7",
  tealText: "#2E9890",
  border: "rgba(24,24,22,0.08)",
  borderStrong: "rgba(24,24,22,0.12)",
  btnBorder: "rgba(24,24,22,0.12)",
  shadowCard: "0 1px 2px rgba(24,24,22,0.05), 0 8px 24px rgba(24,24,22,0.05)",
  shadowDemo: "0 40px 90px rgba(24,24,22,0.18), 0 12px 30px rgba(24,24,22,0.08)",
  ring: "0 0 0 1px rgba(24,24,22,0.07)",
  sidebar: "#F7F7F4",
  neutralTint: "#F4F1EC",
};

/* solid pastel tints per entity (color blocks, never gradients) */
export const ENTITY = [
  { key: "doc", name: "Docs", color: "#4285F4", text: "#3672DD", tint: "#EAF1FE", line: "Proposals, briefs, and reports written with you." },
  { key: "sheet", name: "Sheets", color: "#42C366", text: "#2E9E4F", tint: "#E7F7EC", line: "Budgets and models that calculate themselves." },
  { key: "deck", name: "Decks", color: "#FFAD45", text: "#C77E1F", tint: "#FCF1DE", line: "Pitches and reviews, designed slide by slide." },
  { key: "page", name: "Pages", color: "#8757D7", text: "#8757D7", tint: "#F1EAFB", line: "Live one-pagers your clients open in a browser." },
] as const;

export const MAXW = 1140;
