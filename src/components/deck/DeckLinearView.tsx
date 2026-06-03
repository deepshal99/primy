"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { UniversalSlideRenderer } from "./UniversalSlideRenderer";
import { isHtmlSlide } from "@/lib/types";
import type { HtmlDeckSlide } from "@/lib/types";
import { PresentationMode } from "./PresentationMode";
import { exportDeckToPDF, exportDeckToPPTX } from "./deckExport";
import { refineDeckSlides } from "@/lib/deck/refineClient";
import { toast } from "sonner";
import {
  Play,
  Download,
  RotateCcw,
  ChevronDown,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Build a short brand/style hint for the critique's brand-fit judging. */
function brandContextFrom(
  theme: string,
  style: { label?: string; accent?: string; headingFont?: string; bodyFont?: string } | null
): string {
  if (style) {
    const bits = [
      style.label ? `${style.label} style` : null,
      style.accent ? `accent ${style.accent}` : null,
      style.headingFont ? `${style.headingFont} headings` : null,
    ].filter(Boolean);
    if (bits.length) return bits.join(", ");
  }
  return `${theme} theme`;
}

export function DeckLinearView() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
  const style = useAppStore((s) => s.deckStyle);
  const updateDeckSlides = useAppStore((s) => s.updateDeckSlides);
  const applyRefinedSlides = useAppStore((s) => s.applyRefinedSlides);
  const resetDeckBuilder = useAppStore((s) => s.resetDeckBuilder);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const pendingDeckPolishId = useAppStore((s) => s.pendingDeckPolishId);
  const clearPendingDeckPolish = useAppStore((s) => s.clearPendingDeckPolish);

  const [presenting, setPresenting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishStatus, setPolishStatus] = useState<string | null>(null);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  // IntersectionObserver to track which slide is in view
  useEffect(() => {
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-slide-idx"));
            if (!isNaN(idx)) setCurrentSlideIdx(idx);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-30% 0px -30% 0px",
        threshold: 0,
      }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [slides.length]);

  const handleFieldEdit = useCallback((slideId: string, fieldId: string, newValue: string) => {
    // User editing a slide text field — mark active editing.
    useAppStore.getState().noteEditorInteraction();
    const newSlides = slides.map(s => {
      if (s.id !== slideId || !isHtmlSlide(s)) return s;
      const updatedFields = s.editableFields.map(f =>
        f.id === fieldId ? { ...f, currentValue: newValue } : f
      );
      // Patch the HTML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${s.html}</div>`, "text/html");
      const el = doc.querySelector(`[data-field="${fieldId}"]`);
      if (el) el.textContent = newValue;
      const container = doc.body.firstElementChild;
      return { ...s, html: container ? container.innerHTML : s.html, editableFields: updatedFields };
    });
    updateDeckSlides(newSlides);
  }, [slides, updateDeckSlides]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      await exportDeckToPDF(slides, theme, style);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [slides, theme, style]);

  const handleExportPPTX = useCallback(async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      await exportDeckToPPTX(slides, theme, style);
    } catch (err) {
      console.error("PPTX export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [slides, theme, style]);

  // Render → vision-critique → repair each slide, then merge the polished HTML.
  // `auto` runs (background, post-generation) stay quiet on no-op/failure and
  // are not metered against the user's plan.
  const handlePolish = useCallback(async (auto = false) => {
    if (polishing) return;
    // Slide ids (slide-1, slide-2…) are per-deck, NOT globally unique. Pin the
    // deck we started on so a mid-run deck switch can't merge these polished
    // slides into a different deck that happens to share the same ids.
    const startDeckId = useAppStore.getState().currentEntityId;
    setPolishing(true);
    setPolishStatus("Rendering slides…");
    try {
      const result = await refineDeckSlides(slides, {
        auto,
        brandContext: brandContextFrom(theme, style),
        onProgress: (e) => {
          if (e.stage === "render") setPolishStatus("Rendering slides…");
          else if (e.stage === "critique")
            setPolishStatus(`Reviewing slide ${(e.index ?? 0) + 1}/${e.total ?? slides.length}…`);
          else if (e.stage === "repair")
            setPolishStatus(`Polishing slide ${(e.index ?? 0) + 1} (pass ${e.round ?? 1})…`);
        },
      });
      if (!result) {
        if (!auto) toast.info("No HTML slides to polish yet.");
        return;
      }
      // Bail if the user navigated to a different deck while we worked.
      if (useAppStore.getState().currentEntityId !== startDeckId) return;
      applyRefinedSlides(result.slides);
      const { repaired, avgBefore, avgAfter, critiqued } = result.summary;
      if (repaired > 0) {
        toast.success(
          `Polished ${repaired} slide${repaired === 1 ? "" : "s"} · score ${avgBefore} → ${avgAfter}`
        );
      } else if (!auto && critiqued > 0) {
        toast.success("Slides reviewed. All already looked great.");
      } else if (!auto) {
        toast.error("Couldn't review slides. Please try again.");
      }
    } catch (err) {
      if (!auto) toast.error(err instanceof Error ? err.message : "Slide polish failed.");
    } finally {
      setPolishing(false);
      setPolishStatus(null);
    }
  }, [polishing, slides, theme, style, applyRefinedSlides]);

  // Auto-run the polish pass ONCE for a freshly-generated deck (non-blocking:
  // the deck is already visible; it quietly improves in the background).
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingDeckPolishId || pendingDeckPolishId !== currentEntityId) return;
    if (polishing || autoStartedRef.current === pendingDeckPolishId) return;
    autoStartedRef.current = pendingDeckPolishId;
    clearPendingDeckPolish(); // consume the flag before running (prevents re-fire)
    void handlePolish(true);
  }, [pendingDeckPolishId, currentEntityId, polishing, clearPendingDeckPolish, handlePolish]);

  if (!slides.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <p className="text-[15px] font-medium text-foreground">No slides yet</p>
        <p className="text-[13px] text-muted-foreground">Generate a presentation to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compact toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary">
        <button
          onClick={() => setPresenting(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity active:scale-[0.95]"
        >
          <Play size={13} fill="currentColor" />
          Present
        </button>

        <div ref={exportDropdownRef} className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={exporting}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors",
              exporting && "opacity-60 cursor-wait"
            )}
          >
            <Download size={13} />
            {exporting ? "Exporting..." : "Export"}
            <ChevronDown size={10} />
          </button>
          {exportOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[140px] bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={handleExportPDF}
                className="block w-full px-3.5 py-2 text-[13px] text-left text-foreground hover:bg-accent transition-colors"
              >
                Export as PDF
              </button>
              <button
                onClick={handleExportPPTX}
                className="block w-full px-3.5 py-2 text-[13px] text-left text-foreground hover:bg-accent transition-colors"
              >
                Export as PPTX
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => handlePolish(false)}
          disabled={polishing}
          title="Render each slide, review it with AI vision, and fix contrast / overflow / layout issues"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors active:scale-[0.97]",
            polishing && "opacity-70 cursor-wait"
          )}
        >
          <Wand2 size={13} className={polishing ? "animate-pulse text-accent-amber" : "text-accent-amber"} />
          {polishing ? "Polishing…" : "Polish"}
        </button>

        <div className="flex-1" />

        {polishStatus && (
          <span className="text-[12px] font-medium text-[var(--accent-amber-deep)] truncate max-w-[200px]">
            {polishStatus}
          </span>
        )}

        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
          {currentSlideIdx + 1} / {slides.length}
        </span>

        <button
          onClick={resetDeckBuilder}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground bg-transparent border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <RotateCcw size={13} />
          Regenerate
        </button>
      </div>

      {/* Slides — clean, edge-to-edge, one after another */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto py-6 flex flex-col items-center gap-6">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              ref={(el) => { slideRefs.current[idx] = el; }}
              data-slide-idx={idx}
              className="flex justify-center"
            >
              <UniversalSlideRenderer
                slide={slide}
                theme={theme}
                themeConfig={style}
                scale={0.85}
                editable
                onFieldEdit={(fieldId, newValue) => handleFieldEdit(slide.id, fieldId, newValue)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Presentation mode */}
      {presenting && (
        <PresentationMode
          slides={slides}
          theme={theme}
          style={style}
          startIdx={currentSlideIdx}
          onExit={() => setPresenting(false)}
        />
      )}
    </div>
  );
}
