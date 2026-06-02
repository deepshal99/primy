"use client";

import { cn } from "@/lib/cn";
import { Children, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Staggered blurred rise for stacked text lines (transitions.dev #18).
 * Each child becomes one line; lines rise in sequence on mount. Pass
 * any element per line (headline, subtext, a row of pills).
 *
 *   <TextReveal>
 *     <h1>Projects</h1>
 *     <p>Pick up where you left off.</p>
 *   </TextReveal>
 */
export function TextReveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header";
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const lines = Children.toArray(children);
  return (
    <Tag
      ref={ref as never}
      className={cn("t-stagger", shown && "is-shown", className)}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="t-stagger-line"
          style={{ transitionDelay: `calc(var(--stagger-stagger) * ${i})` }}
        >
          {line}
        </div>
      ))}
    </Tag>
  );
}
