"use client";

/**
 * boardStyle — DialKit-driven live tuning for the project board cards.
 *
 * DialKit (https://github.com/joshpuckett/dialkit) is a dev-time parameter
 * panel: every value below shows up as a slider / spring editor in the floating
 * dial, and edits apply to the live UI instantly. It's auto-hidden in prod, so
 * this is purely a design-tuning surface — tweak the numbers in the browser,
 * read the values off the panel, then bake the ones you like into the defaults.
 *
 * We call useDialKit ONCE here and fan the values out through context, so the
 * board renders a single "Board cards" panel instead of one per card.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useDialKit } from "dialkit";
import type { Transition } from "motion/react";

export type BoardStyle = {
  /** card height in px */
  height: number;
  /** card corner radius in px */
  radius: number;
  /** horizontal padding in px */
  paddingX: number;
  /** vertical padding in px */
  paddingY: number;
  /** px the card rises on hover */
  hoverLift: number;
  /** spring used for entrance + hover (passed straight to motion) */
  spring: Transition;
  /** seconds between each card's staggered entrance */
  stagger: number;
};

const DEFAULTS: BoardStyle = {
  height: 300,
  radius: 12,
  paddingX: 18,
  paddingY: 16,
  hoverLift: 3,
  spring: { type: "spring", visualDuration: 0.45, bounce: 0.18 },
  stagger: 0.045,
};

const BoardStyleContext = createContext<BoardStyle>(DEFAULTS);

export function useBoardStyle(): BoardStyle {
  return useContext(BoardStyleContext);
}

/**
 * Mounts the "Board cards" dial panel and provides the live values to all
 * descendant EntityCards. Wrap the board body in this once.
 */
export function BoardStyleProvider({ children }: { children: ReactNode }) {
  const p = useDialKit("Board cards", {
    layout: {
      height: [300, 200, 480],
      radius: [12, 4, 28],
      paddingX: [18, 8, 40],
      paddingY: [16, 6, 36],
    },
    motion: {
      hoverLift: [3, 0, 16],
      stagger: [0.045, 0, 0.2, 0.005],
      entrance: { type: "spring", visualDuration: 0.45, bounce: 0.18 },
    },
  });

  const value: BoardStyle = {
    height: p.layout.height,
    radius: p.layout.radius,
    paddingX: p.layout.paddingX,
    paddingY: p.layout.paddingY,
    hoverLift: p.motion.hoverLift,
    spring: p.motion.entrance as Transition,
    stagger: p.motion.stagger,
  };

  return <BoardStyleContext.Provider value={value}>{children}</BoardStyleContext.Provider>;
}
