"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";

/**
 * Per-digit pop-in when a number changes (transitions.dev #2).
 * Each character re-enters with a blurred slide; the last two stagger so
 * the value feels alive without looking chaotic. First paint is static —
 * only subsequent changes animate.
 *
 *   <AnimatedNumber value={fileCount} />
 */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const str = String(value);
  const groupRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(str);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prev.current === str) return;
    prev.current = str;
    const el = groupRef.current;
    if (!el) return;
    // Remove → reflow → re-add so the keyframe replays on every change.
    setAnimating(false);
    void el.offsetHeight;
    setAnimating(true);
  }, [str]);

  const chars = str.split("");
  return (
    <span
      ref={groupRef}
      className={cn("t-digit-group tabular-nums", animating && "is-animating", className)}
    >
      {chars.map((ch, i) => {
        const fromEnd = chars.length - 1 - i;
        const stagger = fromEnd === 1 ? "1" : fromEnd === 0 ? "2" : undefined;
        return (
          <span key={`${i}-${ch}`} className="t-digit" data-stagger={stagger}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
