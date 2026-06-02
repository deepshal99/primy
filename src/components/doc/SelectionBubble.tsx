"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { PlateEditor } from "platejs/react";
import { Pencil, ChevronsUpDown, ChevronsDownUp, MessageSquare, Loader2, RotateCcw, X, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { TSelection } from "@platejs/slate";

interface SelectionBubbleProps {
  editor: PlateEditor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

type BubbleState = "idle" | "selecting" | "asking" | "acting" | "streaming" | "result";

// Inline actions are CONTEXT-AWARE: the set adapts to what's being edited. A
// prose document gets writing edits; an HTML page gets copy edits; a sheet gets
// data tidy-ups. (The bubble mounts in the Plate editor today — the registry
// keeps the other surfaces' sets ready as inline AI expands to them.)
type Surface = "doc" | "page" | "sheet";
type InlineAction = { key: string; label: string; icon: typeof Pencil; color: string; bg: string };

const ACTION_SETS: Record<Surface, InlineAction[]> = {
  doc: [
    { key: "improve", label: "Improve", icon: Pencil, color: "#7c5cb8", bg: "#f3eefb" },
    { key: "expand", label: "Expand", icon: ChevronsUpDown, color: "#3b6ad8", bg: "#edf2fd" },
    { key: "shorten", label: "Shorten", icon: ChevronsDownUp, color: "#d97706", bg: "#fef6e7" },
  ],
  page: [
    { key: "improve", label: "Improve copy", icon: Pencil, color: "#7c5cb8", bg: "#f3eefb" },
    { key: "punchier", label: "Punchier", icon: ChevronsUpDown, color: "#3b6ad8", bg: "#edf2fd" },
    { key: "shorten", label: "Shorten", icon: ChevronsDownUp, color: "#d97706", bg: "#fef6e7" },
  ],
  sheet: [
    { key: "improve", label: "Clean up", icon: Pencil, color: "#7c5cb8", bg: "#f3eefb" },
    { key: "shorten", label: "Shorten", icon: ChevronsDownUp, color: "#d97706", bg: "#fef6e7" },
  ],
};

// "Ask AI" — the free-text path, shared across every surface. Kept separate so
// it renders as a distinct affordance (opens an input rather than a fixed prompt).
const ASK = { key: "ask", label: "Ask AI", icon: MessageSquare, color: "#7c5cb8", bg: "#f3eefb" } as const;

const PROMPTS: Record<string, string> = {
  improve: "Improve this text for clarity, grammar, and flow. Keep the meaning and approximate length.",
  expand: "Expand this with more detail, examples, or elaboration. Keep the same tone.",
  shorten: "Make this more concise. Cut filler while preserving the core meaning.",
  punchier: "Rewrite this to be punchier and more compelling, while staying concise.",
};

export function SelectionBubble({ editor, containerRef }: SelectionBubbleProps) {
  const [state, setState] = useState<BubbleState>("idle");
  const [pos, setPos] = useState<{ top: number; left: number; belowTop: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [streamResult, setStreamResult] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [askInput, setAskInput] = useState("");
  const [animateIn, setAnimateIn] = useState(false);
  // Persistent highlight rectangles over the selection — painted by us so the
  // selection stays visible even after focus moves to the Ask-AI input (which
  // collapses the browser's native ::selection).
  const [selRects, setSelRects] = useState<{ top: number; left: number; width: number; height: number }[] | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const askInputRef = useRef<HTMLInputElement>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSelectionRef = useRef<TSelection>(null);

  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const surface: Surface = currentEntityType === "page" ? "page" : currentEntityType === "table" ? "sheet" : "doc";
  const actions = ACTION_SETS[surface];

  const hideBubble = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      setState("idle");
      setPos(null);
      setFlipped(false);
      setStreamResult("");
      setActiveAction(null);
      setHoveredAction(null);
      setAskInput("");
      setSelRects(null);
      savedSelectionRef.current = null;
    }, 200);
  }, []);

  // Track selection changes with 500ms delay
  useEffect(() => {
    const checkSelection = () => {
      if (state === "asking" || state === "acting" || state === "streaming" || state === "result") return;

      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = null;
      }

      try {
        // Use DOM selection as primary source — avoids Slate timing issues
        const domSel = window.getSelection();
        if (!domSel || domSel.isCollapsed || domSel.rangeCount === 0) {
          if (state === "selecting") hideBubble();
          return;
        }

        const domText = domSel.toString();
        if (!domText || domText.trim().length <= 2) {
          if (state === "selecting") hideBubble();
          return;
        }

        // Verify the selection is within the editor container
        const container = containerRef.current;
        if (!container) return;
        const anchorNode = domSel.anchorNode;
        if (!anchorNode || !container.contains(anchorNode)) {
          if (state === "selecting") hideBubble();
          return;
        }

        selectionTimerRef.current = setTimeout(() => {
          try {
            // Re-check DOM selection is still valid after delay
            const freshDomSel = window.getSelection();
            if (!freshDomSel || freshDomSel.isCollapsed || freshDomSel.rangeCount === 0) return;

            const freshText = freshDomSel.toString();
            if (!freshText || freshText.trim().length <= 2) return;

            const range = freshDomSel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const containerRect = container.getBoundingClientRect();

            const BUBBLE_HEIGHT_ESTIMATE = 48;
            const rawTop = rect.top - containerRect.top + container.scrollTop - 12;
            const shouldFlip = rawTop < BUBBLE_HEIGHT_ESTIMATE + 8;

            const top = shouldFlip
              ? rect.bottom - containerRect.top + container.scrollTop + 12
              : rawTop;
            // Result/streaming cards always render BELOW the selection so they
            // grow downward (natural) and never clip behind the top toolbar.
            const belowTop = rect.bottom - containerRect.top + container.scrollTop + 10;

            const containerWidth = containerRect.width;
            const BUBBLE_HALF_WIDTH = 140;
            const left = Math.max(
              BUBBLE_HALF_WIDTH,
              Math.min(rect.left - containerRect.left + rect.width / 2, containerWidth - BUBBLE_HALF_WIDTH)
            );

            // Capture every client rect of the selection (multi-line → several),
            // in container-relative coords, so we can paint a persistent highlight.
            const rects = Array.from(range.getClientRects()).map((rr) => ({
              top: rr.top - containerRect.top + container.scrollTop,
              left: rr.left - containerRect.left + container.scrollLeft,
              width: rr.width,
              height: rr.height,
            }));
            setSelRects(rects.length ? rects : null);

            setPos({ top, left, belowTop });
            setFlipped(shouldFlip);
            setSelectedText(freshText.trim());
            // Save editor selection for replace — may be null if Slate hasn't synced yet
            if (editor.selection) {
              savedSelectionRef.current = JSON.parse(JSON.stringify(editor.selection));
            }
            setState("selecting");
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
          } catch {
            setState("idle");
            setPos(null);
          }
        }, 500);
      } catch {
        // Silently handle any unexpected errors
      }
    };

    document.addEventListener("selectionchange", checkSelection);
    return () => {
      document.removeEventListener("selectionchange", checkSelection);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [editor, containerRef, state, hideBubble]);

  // Clamp bubble within container bounds after render
  useLayoutEffect(() => {
    if (!bubbleRef.current || !containerRef.current || !pos) return;
    const bubble = bubbleRef.current;
    const container = containerRef.current;
    const bRect = bubble.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();

    let newLeft = pos.left;
    if (bRect.right > cRect.right - 8) {
      newLeft = pos.left - (bRect.right - cRect.right + 8);
    }
    if (bRect.left < cRect.left + 8) {
      newLeft = pos.left + (cRect.left + 8 - bRect.left);
    }
    if (newLeft !== pos.left) {
      setPos((p) => p ? { ...p, left: newLeft } : p);
    }
  }, [pos, containerRef]);

  // Dismiss on click outside or Escape
  useEffect(() => {
    if (state === "idle") return;

    const handleClickOutside = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        hideBubble();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideBubble();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state, hideBubble]);

  const run = useCallback(
    async (instruction: string, actionKey: string) => {
      const text = selectedText.trim();
      if (!text || !instruction.trim()) return;

      setState("acting");
      setActiveAction(actionKey);
      setStreamResult("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Edit this text according to the instruction. Return ONLY the edited text — no quotes, no commentary, no markdown fences.\n\nText: "${text}"\n\nInstruction: ${instruction}`,
              },
            ],
            sheetData: useAppStore.getState().sheets,
            docContent: useAppStore.getState().docContent,
          }),
        });

        if (!res.ok || !res.body) throw new Error("AI edit failed");

        setState("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let result = "";
        let buffer = "";
        // Coalesce per-token state writes into one paint per frame so the card
        // grows smoothly instead of thrashing on every chunk.
        let frame: number | null = null;
        const flush = () => { frame = null; setStreamResult(result); };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                result += parsed.text;
                if (frame === null) frame = requestAnimationFrame(flush);
              }
            } catch {
              // skip
            }
          }
        }
        if (frame !== null) cancelAnimationFrame(frame);

        let cleaned = result.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
        }
        // Models sometimes wrap the whole answer in quotes — strip one wrapping pair.
        if (cleaned.length > 1 && cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        setStreamResult(cleaned);
        setState("result");
      } catch {
        toast.error("AI edit failed");
        setState("selecting");
        setActiveAction(null);
      }
    },
    [selectedText]
  );

  const submitAsk = useCallback(() => {
    const q = askInput.trim();
    if (q) run(q, "ask");
  }, [askInput, run]);

  const handleReplace = useCallback(() => {
    if (!streamResult) return;

    try {
      const sel = savedSelectionRef.current;
      if (sel) {
        // Replace the range in a single op. insertText over an expanded range
        // deletes it and inserts inheriting the formatting at the range start —
        // so the new text keeps the original weight/marks instead of resetting.
        editor.tf.insertText(streamResult, { at: sel });
      } else {
        editor.tf.insertText(streamResult);
      }
    } catch {
      try {
        editor.tf.insertText(streamResult);
      } catch {
        toast.error("Could not replace text");
      }
    }

    hideBubble();
  }, [editor, streamResult, hideBubble]);

  const handleRetry = useCallback(() => {
    setStreamResult("");
    setActiveAction(null);
    setState("selecting");
  }, []);

  if (state === "idle" || !pos) return null;

  const activeData = [...actions, ASK].find((a) => a.key === activeAction);
  const isActing = state === "acting";
  // Card-like states (input / loading / streaming / result) render BELOW the
  // selection and grow downward — natural, and never clipped by the top toolbar.
  const isCard = state === "asking" || state === "acting" || state === "streaming" || state === "result";

  return (
    <>
      {/* Persistent selection highlight — keeps the text visibly selected while
          the toolbar / Ask-AI box is open, even after the input takes focus. */}
      {selRects && state !== "selecting" && (
        <div className="absolute inset-0 z-40 pointer-events-none" aria-hidden>
          {selRects.map((r, i) => (
            <div
              key={i}
              className="absolute rounded-[2px]"
              style={{
                top: `${r.top}px`,
                left: `${r.left}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
                background: "rgba(66,133,244,0.18)",
                boxShadow: "inset 0 0 0 1px rgba(66,133,244,0.12)",
              }}
            />
          ))}
        </div>
      )}
      <div
        ref={bubbleRef}
        className="absolute z-50"
        style={{
          top: `${isCard ? pos.belowTop : pos.top}px`,
          left: `${pos.left}px`,
          transform: (isCard || flipped) ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        }}
      >
      <div
        className={cn(
          "transition-all duration-[var(--duration-fast)] ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
          animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-[0.92]"
        )}
        style={{ transformOrigin: (isCard || flipped) ? "center top" : "center bottom" }}
      >
        {isActing ? (
          /* Compact loading pill while waiting for stream */
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]">
            <Loader2
              className="w-3.5 h-3.5 animate-spin"
              style={{ color: activeData?.color || "#FFB43F" }}
            />
            <span className="text-[12px] text-muted-foreground font-medium">
              {activeData?.label || "Processing"}...
            </span>
          </div>
        ) : state === "result" || state === "streaming" ? (
          /* Result card — shown once stream data starts arriving */
          <div
            className="rounded-xl overflow-hidden bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ width: "clamp(260px, 40vw, 340px)" }}
          >
            <div className="px-3.5 py-3 max-h-[160px] overflow-y-auto">
              <p className="text-[13px] text-foreground whitespace-pre-wrap leading-[1.75]">
                {streamResult}
                {state === "streaming" && (
                  <span
                    className="inline-block w-[2px] h-[14px] bg-[#FFB43F] ml-0.5 align-middle"
                    style={{ animation: "cursorBlink 0.8s infinite" }}
                  />
                )}
              </p>
            </div>

            {state === "result" && streamResult && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
                <button
                  onClick={handleReplace}
                  className="flex-1 h-[30px] bg-primary text-primary-foreground rounded-lg text-[12px] font-medium hover:opacity-90 t-colors cursor-pointer"
                >
                  Replace
                </button>
                <button
                  onClick={handleRetry}
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted t-colors cursor-pointer"
                  title="Retry"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={hideBubble}
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted t-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : state === "asking" ? (
          /* Ask AI — free-text instruction box */
          <div className="flex flex-col items-center">
            <div
              className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
              style={{ width: "clamp(280px, 42vw, 360px)" }}
            >
              <ASK.icon className="w-4 h-4 flex-shrink-0" style={{ color: ASK.color }} strokeWidth={2} />
              <input
                ref={askInputRef}
                autoFocus
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitAsk(); }
                  if (e.key === "Escape") { e.preventDefault(); setState("selecting"); }
                }}
                placeholder="Tell AI what to do with this…"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={submitAsk}
                disabled={!askInput.trim()}
                title="Run"
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-35 hover:opacity-90 t-colors cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
            {!flipped ? (
              <svg width="14" height="7" viewBox="0 0 14 7" fill="none" className="mt-[-0.5px]">
                <path d="M5.586 5.586a2 2 0 002.828 0L14 0H0l5.586 5.586z" fill="white" />
                <path d="M0 0l5.586 5.586a2 2 0 002.828 0L14 0" stroke="var(--border)" strokeWidth="1" fill="none" />
              </svg>
            ) : (
              <svg width="14" height="7" viewBox="0 0 14 7" fill="none" className="mb-[-0.5px] rotate-180 order-first">
                <path d="M5.586 5.586a2 2 0 002.828 0L14 0H0l5.586 5.586z" fill="white" />
                <path d="M0 0l5.586 5.586a2 2 0 002.828 0L14 0" stroke="var(--border)" strokeWidth="1" fill="none" />
              </svg>
            )}
          </div>
        ) : (
          /* Floating toolbar */
          <div className="flex flex-col items-center">
            <div className="flex items-center rounded-xl overflow-hidden bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] p-1 gap-[3px]">
              {actions.map((action) => {
                const isHovered = hoveredAction === action.key;
                return (
                  <button
                    key={action.key}
                    className="h-[30px] px-2.5 flex items-center gap-1.5 rounded-lg t-colors active:scale-[0.98] cursor-pointer whitespace-nowrap"
                    style={{
                      background: isHovered ? action.bg : "transparent",
                      color: isHovered ? action.color : "#6b6b80",
                    }}
                    onClick={() => run(PROMPTS[action.key], action.key)}
                    onMouseEnter={() => setHoveredAction(action.key)}
                    onMouseLeave={() => setHoveredAction(null)}
                  >
                    <action.icon className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="text-[12px] font-medium">{action.label}</span>
                  </button>
                );
              })}
              {/* divider + Ask AI (free-text) */}
              <div className="w-px h-5 mx-0.5 flex-shrink-0" style={{ background: "var(--border)" }} />
              <button
                className="h-[30px] px-2.5 flex items-center gap-1.5 rounded-lg t-colors active:scale-[0.98] cursor-pointer whitespace-nowrap"
                style={{
                  background: hoveredAction === ASK.key ? ASK.bg : "transparent",
                  color: hoveredAction === ASK.key ? ASK.color : "#6b6b80",
                }}
                onClick={() => { setAskInput(""); setState("asking"); }}
                onMouseEnter={() => setHoveredAction(ASK.key)}
                onMouseLeave={() => setHoveredAction(null)}
              >
                <ASK.icon className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="text-[12px] font-medium">{ASK.label}</span>
              </button>
            </div>

            {!flipped && (
              <svg width="14" height="7" viewBox="0 0 14 7" fill="none" className="mt-[-0.5px]">
                <path d="M5.586 5.586a2 2 0 002.828 0L14 0H0l5.586 5.586z" fill="white" />
                <path d="M0 0l5.586 5.586a2 2 0 002.828 0L14 0" stroke="var(--border)" strokeWidth="1" fill="none" />
              </svg>
            )}
            {flipped && (
              <svg width="14" height="7" viewBox="0 0 14 7" fill="none" className="mb-[-0.5px] rotate-180 order-first">
                <path d="M5.586 5.586a2 2 0 002.828 0L14 0H0l5.586 5.586z" fill="white" />
                <path d="M0 0l5.586 5.586a2 2 0 002.828 0L14 0" stroke="var(--border)" strokeWidth="1" fill="none" />
              </svg>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
