/**
 * Primy — Design System (Strut-inspired)
 *
 * Black brand (ink #1A1815) on warm near-white (#FCFBF8).
 * Amber (#FFB43F) is the warm accent; blue/pink/purple/teal are the candy set.
 * Entity color lives on workspace dots, not entity icons (icons are monochrome).
 * Typography: Degular (headings) + Inter (body).
 *
 * All colors use CSS var() for automatic dark mode (.dark class).
 */

export const design = {
  colors: {
    brand: {
      // Brand fill = ink/black (matches the black wordmark). White text on it.
      primary: "var(--primary, #1A1815)",
      light: "var(--ink-2, #3B3A37)",
      dark: "#000000",
      subtle: "var(--accent, #F1F0ED)",
      muted: "var(--secondary, #F1F0ED)",
      text: "#ffffff",
    },
    accent: {
      // Warm amber accent (AI dot, highlights, soft pills). Not a white-text fill.
      amber: "var(--accent-amber, #FFB43F)",
      amberDark: "var(--accent-amber-deep, #B87426)",
      amberSubtle: "var(--color-brand-subtle, rgba(255, 180, 63, 0.10))",
      // `gold` kept as an alias of amber for legacy callers.
      gold: "var(--accent-amber, #FFB43F)",
      goldDark: "var(--accent-amber-deep, #B87426)",
      goldSubtle: "var(--color-brand-subtle, rgba(255, 180, 63, 0.10))",
      purple: "var(--accent-purple, #8757D7)",
      purpleDark: "var(--color-accent-purple-dark, #6f43bf)",
      purpleSubtle: "var(--color-accent-purple-subtle, rgba(135, 87, 215, 0.10))",
      teal: "var(--accent-teal, #67CEC8)",
      tealDark: "var(--color-accent-teal-dark, #46a8a2)",
      tealSubtle: "var(--color-accent-teal-subtle, rgba(103, 206, 200, 0.12))",
      pink: "var(--accent-pink, #F073A7)",
      pinkDark: "var(--color-accent-pink-dark, #d4548b)",
      pinkSubtle: "var(--color-accent-pink-subtle, rgba(240, 115, 167, 0.10))",
      coral: "var(--accent-amber, #FFB43F)",
      coralDark: "var(--accent-amber-deep, #B87426)",
      coralSubtle: "var(--color-brand-subtle, rgba(255, 180, 63, 0.10))",
      lavender: "var(--accent-purple, #8757D7)",
      lavenderDark: "var(--color-accent-purple-dark, #6f43bf)",
      lavenderSubtle: "var(--color-accent-purple-subtle, rgba(135, 87, 215, 0.10))",
      blue: "var(--accent-blue, #4285F4)",
      blueDark: "var(--color-accent-blue-dark, #2f6fe0)",
      blueSubtle: "var(--color-accent-blue-subtle, rgba(66, 133, 244, 0.10))",
    },
    entity: {
      doc: "var(--color-entity-doc, #4285F4)",
      docBg: "var(--color-entity-doc-bg, #EDF4FF)",
      sheet: "var(--color-entity-sheet, #2e9e47)",
      sheetBg: "var(--color-entity-sheet-bg, #e8f7ea)",
      deck: "var(--color-entity-deck, #FFAD45)",
      deckBg: "var(--color-entity-deck-bg, #FFF1DF)",
    },
    bg: {
      primary: "var(--background, #FCFBF8)",
      secondary: "var(--color-bg-secondary, #F7F7F4)",
      tertiary: "var(--color-bg-tertiary, #F1F0ED)",
      workspace: "var(--background, #FCFBF8)",
      chat: "var(--color-bg-chat, #FFFDF8)",
      input: "var(--color-bg-input, #F0EFEC)",
      hover: "var(--accent, #F1F0ED)",
      elevated: "var(--card, #FFFDFB)",
      overlay: "var(--color-bg-overlay, rgba(252, 251, 248, 0.95))",
      sidebar: "var(--sidebar, #F7F7F4)",
      sidebarHover: "var(--sidebar-accent, rgba(24,24,22,0.04))",
      sidebarActive: "var(--sidebar-accent, rgba(24,24,22,0.06))",
    },
    text: {
      primary: "var(--foreground, #171716)",
      secondary: "var(--color-text-secondary, #3B3A37)",
      tertiary: "var(--ink-3, #706E68)",
      muted: "var(--muted-foreground, #706E68)",
      placeholder: "var(--color-text-placeholder, #B9B6AE)",
      inverse: "#ffffff",
      sidebar: "var(--sidebar-foreground, #171716)",
      sidebarMuted: "var(--color-text-sidebar-muted, #706E68)",
      sidebarDim: "var(--color-text-sidebar-dim, #857F76)",
    },
    border: {
      default: "var(--border, rgba(24,24,22,0.08))",
      light: "var(--color-border-light, rgba(24,24,22,0.04))",
      strong: "var(--border-strong, rgba(24,24,22,0.12))",
      focus: "var(--ring, #1A1815)",
      brand: "var(--primary, #1A1815)",
      sidebar: "var(--sidebar-border, rgba(24,24,22,0.075))",
    },
    status: {
      success: "var(--color-success, #2e9e47)",
      successBg: "var(--color-success-bg, rgba(46, 158, 71, 0.08))",
      error: "var(--destructive, #d4183d)",
      errorBg: "var(--color-error-bg, rgba(212, 24, 61, 0.06))",
      info: "var(--color-info, #4285F4)",
      infoBg: "var(--color-info-bg, rgba(66, 133, 244, 0.08))",
    },
    step: {
      pending: "var(--color-step-pending, #E2E0DA)",
      active: "var(--accent-amber, #FFB43F)",
      complete: "var(--color-success, #2e9e47)",
      completeBg: "var(--color-success-bg, rgba(46, 158, 71, 0.08))",
    },
  },

  typography: {
    family: {
      heading: "'Degular', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    },
    // ── Type scale (single source of truth) ────────────────────────────
    // One ramp for the entire platform. Every UI font-size MUST land on one
    // of these steps — no off-scale values (no 10.5 / 11.5 / 12.5 / 16.5 …).
    // `role` gives each step a semantic name + where it's used; `size` keeps
    // the legacy t-shirt keys aliased to the same steps for older callers.
    role: {
      micro:     "11px", // timestamps, tiny meta
      caption:   "12px", // chips, counts, eyebrow labels
      bodySm:    "13px", // nav rows, menu items, secondary text, card bullets/prose
      body:      "14px", // default body, inputs, Create-tile label
      bodyLg:    "15px", // emphasized body, view/card titles, chat copy
      h3:        "16px", // section + dialog headings
      h2:        "18px", // brand wordmark, large headings
      h1:        "20px", // page titles
      displaySm: "24px", // home / empty-state headings
      display:   "30px", // hero ("What are you working on?")
    },
    size: {
      "2xs": "11px",
      xs: "11px",
      sm: "12px",
      base: "14px",
      md: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "20px",
      "3xl": "24px",
      "4xl": "30px",
    },
    weight: {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      none: "1",
      tight: "1.25",
      snug: "1.4",
      normal: "1.5",
      relaxed: "1.6",
      loose: "1.8",
    },
    letterSpacing: {
      tighter: "-0.02em",
      tight: "-0.01em",
      normal: "0",
      wide: "0.02em",
      wider: "0.04em",
      widest: "0.06em",
    },
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "40px",
    "4xl": "48px",
    "5xl": "56px",
  },

  radius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "14px",
    "2xl": "20px",
    full: "9999px",
    // Selection pattern: list rows that represent a pickable item — sidebar nav,
    // workspace rows, segmented toggles, filter chips — use `full` (pill) for
    // their hover/active background. Reach for this on any "select me" element.
    pill: "9999px",
  },

  shadows: {
    sm: "0 1px 2px rgba(24, 24, 22, 0.04)",
    md: "0 2px 8px rgba(24, 24, 22, 0.05)",
    lg: "0 4px 16px rgba(24, 24, 22, 0.07)",
    xl: "0 8px 30px rgba(24, 24, 22, 0.09)",
    // Strut elevation — wired to CSS vars so dark mode swaps automatically.
    card: "var(--shadow-card, 0 1px 1px rgba(24,24,22,0.045), 0 9px 22px rgba(24,24,22,0.03))",
    lift: "var(--shadow-lift, 0 10px 28px rgba(24,24,22,0.085))",
    pane: "var(--shadow-pane, 0 18px 45px rgba(24,24,22,0.075))",
    brand: "0 8px 22px rgba(24, 24, 22, 0.12)",
    dropdown: "0 8px 24px rgba(24, 24, 22, 0.10), 0 0 0 1px rgba(24, 24, 22, 0.04)",
  },

  animation: {
    duration: {
      fast: "120ms",     // micro-interactions: hover, active, toggle
      normal: "200ms",   // standard: fade, scale, color change
      slow: "320ms",     // layout: panel resize, drawer, view switch
      enter: "240ms",    // entrance: modals, new content appearing
    },
    easing: {
      default: "cubic-bezier(0.25, 0.1, 0.25, 1)",  // smooth decel
      spring: "cubic-bezier(0.16, 1, 0.3, 1)",       // spring overshoot for entrances
      out: "cubic-bezier(0, 0, 0.2, 1)",             // fast exit
    },
  },

  layout: {
    navRailWidth: "60px",
    drawerWidth: "260px",
    chatMaxWidth: "720px",
    chatMinWidth: "300px",
    chatDefaultWidth: "400px",
    chatMaxWidthSplit: "420px",
    headerHeight: "48px",
    inputMaxHeight: "150px",
  },

  zIndex: {
    base: 0,
    dropdown: 50,
    overlay: 100,
    modal: 200,
    toast: 300,
  },
} as const;

export const brandButtonStyle = {
  backgroundColor: design.colors.brand.primary,
  color: design.colors.brand.text,
} as const;

export function getStepColor(status: "pending" | "active" | "complete") {
  return design.colors.step[status];
}

export type DesignTokens = typeof design;
