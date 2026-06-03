"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  StreamTask,
  PHASE_SCRIPTS,
  activePhaseIndex,
} from "@/lib/streamPhases";

/** A clean circular step badge: filled check (done), spinner (active), hollow ring (pending). */
function StepStatus({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done") {
    return (
      <span
        className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
        style={{ background: "var(--accent-amber-deep, #B87426)" }}
      >
        <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: "#fff" }} aria-hidden />
      </span>
    );
  }
  if (state === "active") {
    return (
      <Loader2
        className="w-4 h-4 flex-shrink-0 animate-spin"
        strokeWidth={2.25}
        style={{ color: "var(--accent-amber, #FFB43F)" }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="w-4 h-4 rounded-full flex-shrink-0"
      style={{ border: "1.5px solid var(--border-strong)" }}
      aria-hidden
    />
  );
}

/**
 * Task-aware phased loading shown while the model streams. Renders a short
 * checklist (Reading -> Outlining -> Designing -> Building) where completed
 * steps get a check, the active step spins, and pending steps sit faint.
 *
 * Honesty: the final "building" step only activates once `outputStarted` (a real
 * operation block has begun streaming, or text has started for a plain answer).
 * Until then the active step holds at the second-to-last, so we never claim to
 * be building before we are.
 */
export function StreamPhases({
  task,
  readingFiles,
  outputStarted,
}: {
  task: StreamTask;
  readingFiles: string[];
  outputStarted: boolean;
}) {
  const phases = PHASE_SCRIPTS[task];
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick a coarse clock so simulated steps advance. Stops mattering once
  // outputStarted flips (activePhaseIndex jumps to the final step regardless).
  useEffect(() => {
    if (startRef.current === null) startRef.current = Date.now();
    if (outputStarted) return; // no need to keep ticking once building for real
    const t = setInterval(() => {
      if (startRef.current !== null) setElapsed(Date.now() - startRef.current);
    }, 400);
    return () => clearInterval(t);
  }, [outputStarted]);

  const activeIndex = activePhaseIndex({
    phaseCount: phases.length,
    elapsedMs: elapsed,
    outputStarted,
    allowFinalBySim: task === "answer",
  });

  // Enrich the "read" step with the files we actually pulled in.
  const labelFor = (id: string, fallback: string) => {
    if (id === "read" && readingFiles.length > 0) {
      const shown = readingFiles.slice(0, 2).join(", ");
      const extra = readingFiles.length > 2 ? ` +${readingFiles.length - 2}` : "";
      return `Reading ${shown}${extra}`;
    }
    return fallback;
  };

  return (
    <div className="flex flex-col gap-1.5 py-1 stagger-in" aria-live="polite">
      {phases.map((p, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        return (
          <div key={p.id} className="flex items-center gap-2.5">
            <StepStatus state={state} />
            <span
              className={state === "active" ? "text-[13px] font-medium shimmer-text" : "text-[13px]"}
              style={{
                color: state === "done" ? "var(--ink-3)" : state === "active" ? "var(--ink-2)" : "var(--ink-4)",
              }}
            >
              {labelFor(p.id, p.label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
