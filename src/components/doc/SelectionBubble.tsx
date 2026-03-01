"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { PlateEditor } from "platejs/react";
import { Wand2, Expand, Minimize2, ListChecks, Loader2, RotateCcw, X } from "lucide-react";
import { MarkdownPlugin } from "@platejs/markdown";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { BaseSelection } from "slate";

interface SelectionBubbleProps {
  editor: PlateEditor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

type BubbleState = "idle" | "selecting" | "acting" | "streaming" | "result";

const ACTIONS = [
  { key: "improve", label: "Improve", icon: Wand2, color: "#7c5cb8", bg: "#f3eefb" },
  { key: "expand", label: "Expand", icon: Expand, color: "#3b6ad8", bg: "#edf2fd" },
  { key: "shorten", label: "Shorten", icon: Minimize2, color: "#d97706", bg: "#fef6e7" },
  { key: "format", label: "Format", icon: ListChecks, color: "#2e9e47", bg: "#eef8f0" },
] as const;

const PROMPTS: Record<string, string> = {
  improve: "Improve this text for clarity, grammar, and readability. Keep the same meaning and approximate length.",
  expand: "Expand on this text with more detail, examples, or elaboration. Keep the same tone.",
  shorten: "Make this text more concise. Remove unnecessary words while preserving the core meaning.",
  format: "Improve the formatting of this text. Add appropriate markdown formatting like headings, bold, lists where helpful.",
};

export function SelectionBubble({ editor, containerRef }: SelectionBubbleProps) {
  const [state, setState] = useState<BubbleState>("idle");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [streamResult, setStreamResult] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSelectionRef = useRef<BaseSelection>(null);

  const hideBubble = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      setState("idle");
      setPos(null);
      setFlipped(false);
      setStreamResult("");
      setActiveAction(null);
      setHoveredAction(null);
      savedSelectionRef.current = null;
    }, 200);
  }, []);

  // Track selection changes with 500ms delay
  useEffect(() => {
    const checkSelection = () => {
      if (state === "acting" || state === "streaming" || state === "result") return;

      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = null;
      }

      const sel = editor.selection;
      if (!sel || !sel.anchor || !sel.focus) {
        if (state === "selecting") hideBubble();
        return;
      }

      const isCollapsed =
        sel.anchor.path.join(",") === sel.focus.path.join(",") &&
        sel.anchor.offset === sel.focus.offset;

      if (isCollapsed) {
        if (state === "selecting") hideBubble();
        return;
      }

      const text = editor.api.string(sel);
      if (!text || text.trim().length <= 2) {
        if (state === "selecting") hideBubble();
        return;
      }

      selectionTimerRef.current = setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;

        try {
          const domSel = window.getSelection();
          if (!domSel || domSel.rangeCount === 0) return;
          const range = domSel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const BUBBLE_HEIGHT_ESTIMATE = 48;
          const rawTop = rect.top - containerRect.top + container.scrollTop - 12;
          const shouldFlip = rawTop < BUBBLE_HEIGHT_ESTIMATE + 8;

          const top = shouldFlip
            ? rect.bottom - containerRect.top + container.scrollTop + 12
            : rawTop;

          const containerWidth = containerRect.width;
          const BUBBLE_HALF_WIDTH = 140;
          const left = Math.max(
            BUBBLE_HALF_WIDTH,
            Math.min(rect.left - containerRect.left + rect.width / 2, containerWidth - BUBBLE_HALF_WIDTH)
          );

          setPos({ top, left });
          setFlipped(shouldFlip);
          setSelectedText(text);
          // Save the editor selection so we can restore it for replace
          savedSelectionRef.current = JSON.parse(JSON.stringify(sel));
          setState("selecting");
          requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
        } catch {
          setState("idle");
          setPos(null);
        }
      }, 500);
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

  const runAction = useCallback(
    async (actionKey: string) => {
      if (!selectedText || !PROMPTS[actionKey]) return;

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
                content: `Edit this text according to the instruction. Return ONLY the edited text, nothing else. Do not wrap in markdown fences.\n\nText: "${selectedText}"\n\nInstruction: ${PROMPTS[actionKey]}`,
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
                setStreamResult(result);
              }
            } catch {
              // skip
            }
          }
        }

        let cleaned = result.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
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

  const handleReplace = useCallback(() => {
    if (!streamResult) return;

    try {
      const sel = savedSelectionRef.current;
      if (sel) {
        editor.tf.select(sel);
        editor.tf.delete();

        // For "format" action, deserialize markdown into Slate nodes
        if (activeAction === "format") {
          try {
            const nodes = editor.getApi(MarkdownPlugin).markdown.deserialize(streamResult);
            if (nodes && nodes.length > 0) {
              editor.tf.insertNodes(nodes);
            } else {
              editor.tf.insertText(streamResult);
            }
          } catch {
            editor.tf.insertText(streamResult);
          }
        } else {
          editor.tf.insertText(streamResult);
        }
      }
    } catch {
      try {
        editor.tf.insertText(streamResult);
      } catch {
        toast.error("Could not replace text");
      }
    }

    hideBubble();
  }, [editor, streamResult, activeAction, hideBubble]);

  const handleRetry = useCallback(() => {
    setStreamResult("");
    setActiveAction(null);
    setState("selecting");
  }, []);

  if (state === "idle" || !pos) return null;

  const activeData = ACTIONS.find((a) => a.key === activeAction);
  const isProcessing = state === "acting" || state === "streaming";
  const isActing = state === "acting";

  return (
    <div
      ref={bubbleRef}
      className="absolute z-50"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        transform: flipped ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      <div
        className={cn(
          "transition-all duration-150 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
          animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-[0.92]"
        )}
        style={{ transformOrigin: flipped ? "center top" : "center bottom" }}
      >
        {isActing ? (
          /* Compact loading pill while waiting for stream */
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]">
            <Loader2
              className="w-3.5 h-3.5 animate-spin"
              style={{ color: activeData?.color || "#ff4a00" }}
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
                    className="inline-block w-[2px] h-[14px] bg-[#ff4a00] ml-0.5 align-middle"
                    style={{ animation: "cursorBlink 0.8s infinite" }}
                  />
                )}
              </p>
            </div>

            {state === "result" && streamResult && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
                <button
                  onClick={handleReplace}
                  className="flex-1 h-[30px] bg-[#ff4a00] text-white rounded-lg text-[12px] font-medium hover:bg-[#e54400] transition-colors duration-150 cursor-pointer"
                >
                  Replace
                </button>
                <button
                  onClick={handleRetry}
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
                  title="Retry"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={hideBubble}
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Floating toolbar */
          <div className="flex flex-col items-center">
            <div className="flex items-center rounded-xl overflow-hidden bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] p-1 gap-[3px]">
              {ACTIONS.map((action) => {
                const isHovered = hoveredAction === action.key;
                return (
                  <button
                    key={action.key}
                    className="h-[30px] px-2.5 flex items-center gap-1.5 rounded-lg transition-colors duration-150 active:scale-[0.98] cursor-pointer"
                    style={{
                      background: isHovered ? action.bg : "transparent",
                      color: isHovered ? action.color : "#6b6b80",
                    }}
                    onClick={() => runAction(action.key)}
                    onMouseEnter={() => setHoveredAction(action.key)}
                    onMouseLeave={() => setHoveredAction(null)}
                  >
                    <action.icon className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="text-[12px] font-medium">{action.label}</span>
                  </button>
                );
              })}
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
  );
}
