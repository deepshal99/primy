"use client";

import { useEffect, useRef, useState } from "react";
import {
  StreamTask,
  PHASE_SCRIPTS,
  activePhaseIndex,
} from "@/lib/streamPhases";
import "./thinking-loader.css";

/**
 * The Primy brand mark (the four ink bars) animated as a soft left-to-right
 * opacity wave — our logo, thinking. Brand-unique and calm: opacity only, so
 * the bars' angles stay intact and nothing bounces or jitters.
 */
function BrandThinkingMark() {
  return (
    <svg
      className="brand-thinking"
      width={18}
      height={18}
      viewBox="0 0 22 22"
      fill="currentColor"
      aria-hidden
    >
      <rect x="0" y="5" width="6" height="12" rx="3" />
      <rect x="7" y="2" width="5" height="18" rx="2.5" transform="rotate(-28 9.5 11)" />
      <rect x="12" y="3" width="5" height="16" rx="2.5" transform="rotate(28 14.5 11)" />
      <rect x="18" y="6" width="4" height="10" rx="2" />
    </svg>
  );
}

/**
 * Task-aware "thinking" state shown while the model streams. Instead of a
 * stacked checklist, this cycles through the phases (Reading -> Outlining ->
 * Designing -> Building) ONE at a time on a single line: a pulsing three-dot
 * loader plus the current step's label, which swaps with a quick fade-up as the
 * active phase advances. Cleaner and calmer than showing every step at once.
 *
 * Honesty: the final "building" step only activates once `outputStarted` (a real
 * operation block has begun streaming, or text has started for a plain answer).
 * Until then the cycle holds at the second-to-last step, so we never claim to be
 * building before we are.
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
    // The final step always waits for real output — never simulate into it. We
    // never claim "building"/"composing" before it's actually happening.
    allowFinalBySim: false,
  });

  // Enrich the "read" step with the files we actually pulled in.
  const current = phases[activeIndex] ?? phases[0];
  let label = current.label;
  if (current.id === "read" && readingFiles.length > 0) {
    const shown = readingFiles.slice(0, 2).join(", ");
    const extra = readingFiles.length > 2 ? ` +${readingFiles.length - 2}` : "";
    label = `Reading ${shown}${extra}`;
  }

  return (
    <div className="thinking-loader py-1" aria-live="polite">
      <BrandThinkingMark />
      {/* Keyed on the label text so each phase change re-mounts and replays the
          fade-up swap. Inner span carries the shimmer sweep. */}
      <span key={label} className="phase-label-swap">
        <span className="shimmer-text text-[13px] font-medium">{label}</span>
      </span>
    </div>
  );
}
