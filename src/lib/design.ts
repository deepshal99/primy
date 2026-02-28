/**
 * Drafta AI — Design System
 *
 * Electric orange (#FF6B00) on pure white.
 * Typography: Outfit (headings) + DM Sans (body).
 * Clean, crisp, zero warm tones.
 *
 * All colors use CSS var() for automatic dark mode.
 */

export const design = {
  colors: {
    brand: {
      primary: "var(--color-brand, #FF6B00)",
      light: "var(--color-brand-light, #FF8A33)",
      dark: "var(--color-brand-dark, #E05E00)",
      subtle: "var(--color-brand-subtle, rgba(255, 107, 0, 0.06))",
      muted: "var(--color-brand-muted, rgba(255, 107, 0, 0.12))",
      text: "#ffffff",
    },
    accent: {
      gold: "var(--color-accent-gold, #FF6B00)",
      goldDark: "var(--color-accent-gold-dark, #E05E00)",
      goldSubtle: "var(--color-accent-gold-subtle, rgba(255, 107, 0, 0.06))",
      purple: "var(--color-accent-purple, #7B68EE)",
      purpleDark: "var(--color-accent-purple-dark, #6050D0)",
      purpleSubtle: "var(--color-accent-purple-subtle, rgba(123, 104, 238, 0.06))",
      teal: "var(--color-accent-teal, #10B981)",
      tealDark: "var(--color-accent-teal-dark, #059669)",
      tealSubtle: "var(--color-accent-teal-subtle, rgba(16, 185, 129, 0.06))",
      coral: "var(--color-accent-coral, #F97066)",
      coralDark: "var(--color-accent-coral-dark, #E0544A)",
      coralSubtle: "var(--color-accent-coral-subtle, rgba(249, 112, 102, 0.06))",
      lavender: "var(--color-accent-lavender, #A78BFA)",
      lavenderDark: "var(--color-accent-lavender-dark, #8B5CF6)",
      lavenderSubtle: "var(--color-accent-lavender-subtle, rgba(167, 139, 250, 0.06))",
      blue: "var(--color-accent-coral, #F97066)",
      blueDark: "var(--color-accent-coral-dark, #E0544A)",
      blueSubtle: "var(--color-accent-coral-subtle, rgba(249, 112, 102, 0.06))",
    },
    entity: {
      doc: "var(--color-entity-doc, #6366F1)",
      docBg: "var(--color-entity-doc-bg, #F5F3FF)",
      sheet: "var(--color-entity-sheet, #10B981)",
      sheetBg: "var(--color-entity-sheet-bg, #ECFDF5)",
      diagram: "var(--color-entity-diagram, #06B6D4)",
      diagramBg: "var(--color-entity-diagram-bg, #ECFEFF)",
      deck: "var(--color-entity-deck, #F59E0B)",
      deckBg: "var(--color-entity-deck-bg, #FFFBEB)",
    },
    bg: {
      primary: "var(--color-bg-primary, #FFFFFF)",
      secondary: "var(--color-bg-secondary, #FAFAFA)",
      tertiary: "var(--color-bg-tertiary, #F5F5F5)",
      workspace: "var(--color-bg-workspace, #FFFFFF)",
      chat: "var(--color-bg-chat, #FFFFFF)",
      input: "var(--color-bg-input, #FAFAFA)",
      hover: "var(--color-bg-hover, #F5F5F5)",
      elevated: "var(--color-bg-elevated, #FFFFFF)",
      overlay: "var(--color-bg-overlay, rgba(255, 255, 255, 0.95))",
      sidebar: "var(--color-bg-sidebar, #FFFFFF)",
      sidebarHover: "var(--color-bg-sidebar-hover, #F5F5F5)",
      sidebarActive: "var(--color-bg-sidebar-active, #F0F0F0)",
    },
    text: {
      primary: "var(--color-text-primary, #111111)",
      secondary: "var(--color-text-secondary, #555555)",
      muted: "var(--color-text-muted, #999999)",
      placeholder: "var(--color-text-placeholder, #CCCCCC)",
      inverse: "#ffffff",
      sidebar: "var(--color-text-sidebar, #111111)",
      sidebarMuted: "var(--color-text-sidebar-muted, #555555)",
      sidebarDim: "var(--color-text-sidebar-dim, #999999)",
    },
    border: {
      default: "var(--color-border, #F0F0F0)",
      light: "var(--color-border-light, #F5F5F5)",
      focus: "var(--color-border-focus, #E0E0E0)",
      brand: "var(--color-brand, #FF6B00)",
      sidebar: "var(--color-border-sidebar, #F0F0F0)",
    },
    status: {
      success: "var(--color-success, #10B981)",
      successBg: "var(--color-success-bg, rgba(16, 185, 129, 0.06))",
      error: "var(--color-error, #EF4444)",
      errorBg: "var(--color-error-bg, rgba(239, 68, 68, 0.06))",
      info: "var(--color-info, #3B82F6)",
      infoBg: "var(--color-info-bg, rgba(59, 130, 246, 0.06))",
    },
    step: {
      pending: "var(--color-step-pending, #E0E0E0)",
      active: "var(--color-brand, #FF6B00)",
      complete: "var(--color-success, #10B981)",
      completeBg: "var(--color-success-bg, rgba(16, 185, 129, 0.06))",
    },
  },

  typography: {
    family: {
      heading: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
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
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "20px",
    full: "9999px",
  },

  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.03)",
    md: "0 2px 8px rgba(0, 0, 0, 0.04)",
    lg: "0 4px 16px rgba(0, 0, 0, 0.06)",
    xl: "0 8px 32px rgba(0, 0, 0, 0.08)",
    card: "0 1px 3px rgba(0, 0, 0, 0.02)",
    brand: "0 4px 14px rgba(255, 107, 0, 0.25)",
    dropdown: "0 8px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)",
  },

  animation: {
    duration: {
      fast: "100ms",
      normal: "200ms",
      slow: "350ms",
      layout: "450ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    },
  },

  layout: {
    chatMaxWidth: "720px",
    chatMinWidth: "340px",
    chatDefaultWidth: "400px",
    chatMaxWidthSplit: "480px",
    sidebarWidth: "280px",
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
