/**
 * Drafta AI Design System
 *
 * Conversion.ai brand aesthetic — warm, minimal, professional.
 * Green primary actions, orange AI accents, purple doc/workflow accents.
 * Warm cream backgrounds, dark sidebar, flat cards with subtle borders.
 */

export const design = {
  // ── Colors ──
  colors: {
    brand: {
      primary: "#2DB67D",       // Green — primary CTAs, active states, main actions
      light: "#3DC98E",
      dark: "#1E9B68",
      subtle: "rgba(45, 182, 125, 0.08)",
      muted: "rgba(45, 182, 125, 0.14)",
      text: "#ffffff",
    },
    accent: {
      gold: "#E5953E",          // Warm orange — AI/magic features, sparkle actions
      goldDark: "#C47A2A",
      goldSubtle: "rgba(229, 149, 62, 0.07)",
      purple: "#8B5CF6",        // Purple — docs, workflows, triggers
      purpleDark: "#6D40D9",
      purpleSubtle: "rgba(139, 92, 246, 0.07)",
      teal: "#2DB67D",          // Alias to brand green for sheet indicators
      tealDark: "#1E9B68",
      tealSubtle: "rgba(45, 182, 125, 0.07)",
    },
    bg: {
      primary: "#FAFAF8",       // Warm off-white — slightly less yellow than before
      secondary: "#F3F2EF",     // Light cream for headers, secondary areas
      tertiary: "#EBEAE6",
      sidebar: "#1C1B18",       // Slightly darker sidebar
      sidebarHover: "#282723",
      sidebarActive: "#33322D",
      chat: "#FAFAF8",
      input: "#FFFFFF",
      hover: "#EFEEE9",
      elevated: "#FFFFFF",      // Cards, modals — pure white
      overlay: "rgba(250, 250, 248, 0.85)",
    },
    text: {
      primary: "#1A1A18",       // Slightly deeper for contrast
      secondary: "#6B6963",
      muted: "#9E9B94",
      placeholder: "#C2BFB9",
      inverse: "#ffffff",
      sidebar: "#D4D1CC",
      sidebarMuted: "#8A8680",
      sidebarDim: "#5C5955",
    },
    border: {
      default: "#E6E4DF",       // Lighter, more transparent feel
      light: "#EEEDEA",         // Barely visible — row separators, subtle dividers
      focus: "#C4C1BB",
      brand: "#2DB67D",
      sidebar: "#33322D",
    },
    status: {
      success: "#2DB67D",
      successBg: "rgba(45, 182, 125, 0.08)",
      error: "#E5484D",
      errorBg: "rgba(229, 72, 77, 0.08)",
      info: "#3B82F6",
      infoBg: "rgba(59, 130, 246, 0.08)",
    },
    step: {
      pending: "#D4D1CC",
      active: "#E5953E",
      complete: "#2DB67D",
      completeBg: "rgba(45, 182, 125, 0.08)",
    },
  },

  // ── Typography ──
  typography: {
    family: {
      heading: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",
    },
    size: {
      // UI scale — for interface elements
      "2xs": "10px",
      xs: "11px",
      sm: "12px",
      base: "14px",
      md: "14px",
      // Content scale — for readable content
      lg: "15px",
      xl: "17px",
      // Display scale — for headings
      "2xl": "20px",
      "3xl": "26px",
      "4xl": "32px",
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
      tight: "1.2",
      snug: "1.35",
      normal: "1.5",
      relaxed: "1.65",
      loose: "1.8",
    },
    letterSpacing: {
      tighter: "-0.03em",
      tight: "-0.02em",
      normal: "0",
      wide: "0.02em",
      wider: "0.05em",
      widest: "0.08em",
    },
  },

  // ── Spacing ──
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "40px",
    "5xl": "48px",
  },

  // ── Border Radius ──
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "20px",
    full: "9999px",
  },

  // ── Shadows — much flatter, Conversion AI uses minimal shadows ──
  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.03)",
    md: "0 1px 4px rgba(0, 0, 0, 0.04)",
    lg: "0 2px 8px rgba(0, 0, 0, 0.06)",
    xl: "0 4px 16px rgba(0, 0, 0, 0.08)",
    card: "0 0 0 1px rgba(0, 0, 0, 0.04)",               // Border-only, no shadow
    brand: "0 2px 8px rgba(45, 182, 125, 0.2)",
    dropdown: "0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
  },

  // ── Animation ──
  animation: {
    duration: {
      fast: "150ms",
      normal: "250ms",
      slow: "400ms",
      layout: "500ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    },
  },

  // ── Layout ──
  layout: {
    chatMaxWidth: "720px",
    chatMinWidth: "340px",
    chatDefaultWidth: "400px",
    chatMaxWidthSplit: "560px",
    sidebarWidth: "380px",
    headerHeight: "52px",
    inputMaxHeight: "150px",
  },

  // ── Z-Index ──
  zIndex: {
    base: 0,
    dropdown: 50,
    overlay: 100,
    modal: 200,
    toast: 300,
  },
} as const;

// ── Helpers ──

/** Get a Tailwind-compatible inline style object for brand button */
export const brandButtonStyle = {
  backgroundColor: design.colors.brand.primary,
  color: design.colors.brand.text,
} as const;

/** Get step indicator color by status */
export function getStepColor(status: "pending" | "active" | "complete") {
  return design.colors.step[status];
}

export type DesignTokens = typeof design;
