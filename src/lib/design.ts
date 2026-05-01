/**
 * Drafta AI — Design System
 *
 * Warm orange (#ff4a00) on warm white (#fafaf8).
 * Typography: Degular (headings) + Inter (body).
 * Clean, warm, professional.
 *
 * All colors use CSS var() for automatic dark mode.
 */

export const design = {
  colors: {
    brand: {
      primary: "var(--primary, #ff4a00)",
      light: "var(--color-brand-light, #ff6b2e)",
      dark: "var(--color-brand-dark, #e04300)",
      subtle: "var(--color-brand-subtle, rgba(255, 74, 0, 0.06))",
      muted: "var(--color-brand-muted, rgba(255, 74, 0, 0.12))",
      text: "#ffffff",
    },
    accent: {
      gold: "var(--primary, #ff4a00)",
      goldDark: "var(--color-brand-dark, #e04300)",
      goldSubtle: "var(--color-brand-subtle, rgba(255, 74, 0, 0.06))",
      purple: "var(--color-accent-purple, #7c5cb8)",
      purpleDark: "var(--color-accent-purple-dark, #6a4da0)",
      purpleSubtle: "var(--color-accent-purple-subtle, rgba(124, 92, 184, 0.06))",
      teal: "var(--color-accent-teal, #2e9e47)",
      tealDark: "var(--color-accent-teal-dark, #248a3c)",
      tealSubtle: "var(--color-accent-teal-subtle, rgba(46, 158, 71, 0.06))",
      coral: "var(--color-accent-coral, #d4582a)",
      coralDark: "var(--color-accent-coral-dark, #b84a22)",
      coralSubtle: "var(--color-accent-coral-subtle, rgba(212, 88, 42, 0.06))",
      lavender: "var(--color-accent-lavender, #7c5cb8)",
      lavenderDark: "var(--color-accent-lavender-dark, #6a4da0)",
      lavenderSubtle: "var(--color-accent-lavender-subtle, rgba(124, 92, 184, 0.06))",
      blue: "var(--color-accent-blue, #4a7aed)",
      blueDark: "var(--color-accent-blue-dark, #3d68d4)",
      blueSubtle: "var(--color-accent-blue-subtle, rgba(74, 122, 237, 0.06))",
    },
    entity: {
      doc: "var(--color-entity-doc, #4a7aed)",
      docBg: "var(--color-entity-doc-bg, #f0f4fd)",
      sheet: "var(--color-entity-sheet, #2e9e47)",
      sheetBg: "var(--color-entity-sheet-bg, #e8f7ea)",
      deck: "var(--color-entity-deck, #d4582a)",
      deckBg: "var(--color-entity-deck-bg, #fde8dc)",
    },
    bg: {
      primary: "var(--background, #fafaf8)",
      secondary: "var(--color-bg-secondary, #f5f5f3)",
      tertiary: "var(--color-bg-tertiary, #f0f0ee)",
      workspace: "var(--background, #fafaf8)",
      chat: "var(--background, #fafaf8)",
      input: "var(--color-bg-input, #f7f7f5)",
      hover: "var(--accent, #f4f4f2)",
      elevated: "var(--card, #ffffff)",
      overlay: "var(--color-bg-overlay, rgba(250, 250, 248, 0.95))",
      sidebar: "var(--sidebar-background, #fafaf8)",
      sidebarHover: "var(--sidebar-accent, #f0f0ee)",
      sidebarActive: "var(--sidebar-accent, #f0f0ee)",
    },
    text: {
      primary: "var(--foreground, #1a1a1a)",
      secondary: "var(--color-text-secondary, #555555)",
      muted: "var(--muted-foreground, #737373)",
      placeholder: "var(--color-text-placeholder, #a3a3a3)",
      inverse: "#ffffff",
      sidebar: "var(--sidebar-foreground, #1a1a1a)",
      sidebarMuted: "var(--sidebar-foreground, #555555)",
      sidebarDim: "var(--color-text-sidebar-dim, #737373)",
    },
    border: {
      default: "var(--border, #e8e8ed)",
      light: "var(--color-border-light, #f0f0f0)",
      focus: "var(--ring, #ff4a00)",
      brand: "var(--primary, #ff4a00)",
      sidebar: "var(--sidebar-border, #e8e7e4)",
    },
    status: {
      success: "var(--color-success, #2e9e47)",
      successBg: "var(--color-success-bg, rgba(46, 158, 71, 0.06))",
      error: "var(--destructive, #ef4444)",
      errorBg: "var(--color-error-bg, rgba(239, 68, 68, 0.06))",
      info: "var(--color-info, #4a7aed)",
      infoBg: "var(--color-info-bg, rgba(74, 122, 237, 0.06))",
    },
    step: {
      pending: "var(--color-step-pending, #e0e0e0)",
      active: "var(--primary, #ff4a00)",
      complete: "var(--color-success, #2e9e47)",
      completeBg: "var(--color-success-bg, rgba(46, 158, 71, 0.06))",
    },
  },

  typography: {
    family: {
      heading: "'Degular', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    },
    size: {
      "2xs": "10px",
      xs: "11px",
      sm: "12px",
      base: "14px",
      md: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "20px",
      "3xl": "24px",
      "4xl": "28px",
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
  },

  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.03)",
    md: "0 2px 8px rgba(0, 0, 0, 0.04)",
    lg: "0 4px 16px rgba(0, 0, 0, 0.06)",
    xl: "0 8px 30px rgba(0, 0, 0, 0.08)",
    card: "0 1px 3px rgba(0, 0, 0, 0.02)",
    brand: "0 4px 14px rgba(255, 74, 0, 0.25)",
    dropdown: "0 8px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)",
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
