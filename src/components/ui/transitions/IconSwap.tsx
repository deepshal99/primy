"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Cross-fade two icons stacked in the same slot (blur + scale).
 * transitions.dev #9 — pure CSS, driven by the `state` prop.
 *
 * Both icons stay mounted; only opacity/blur/scale change, so the swap
 * is GPU-cheap and never reflows the surrounding layout.
 *
 *   <IconSwap state={copied ? "b" : "a"} a={<Copy />} b={<Check />} />
 */
export function IconSwap({
  state,
  a,
  b,
  className,
}: {
  state: "a" | "b";
  a: ReactNode;
  b: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("t-icon-swap", className)} data-state={state}>
      <span className="t-icon" data-icon="a" aria-hidden={state !== "a"}>
        {a}
      </span>
      <span className="t-icon" data-icon="b" aria-hidden={state !== "b"}>
        {b}
      </span>
    </span>
  );
}
