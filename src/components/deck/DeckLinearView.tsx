"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { UniversalSlideRenderer } from "./UniversalSlideRenderer";
import { isHtmlSlide } from "@/lib/types";
import type { HtmlDeckSlide } from "@/lib/types";
import { PresentationMode } from "./PresentationMode";
import { exportDeckToPDF, exportDeckToPPTX } from "./deckExport";
import {
  Play,
  Download,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function DeckLinearView() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
  const style = useAppStore((s) => s.deckStyle);
  const updateDeckSlides = useAppStore((s) => s.updateDeckSlides);
  const resetDeckBuilder = useAppStore((s) => s.resetDeckBuilder);

  const [presenting, setPresenting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [exporting, setExporting] = useState(false);

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

  if (!slides.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#6b6b80] gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#95928E" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <p className="text-[15px] font-medium text-[#1a1a2e]">No slides yet</p>
        <p className="text-[13px] text-[#95928E]">Generate a presentation to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compact toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#e8e7e4] bg-white">
        <button
          onClick={() => setPresenting(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold text-white bg-[#d4582a] rounded-lg hover:bg-[#c04d24] transition-colors active:scale-[0.97]"
        >
          <Play size={13} fill="currentColor" />
          Present
        </button>

        <div ref={exportDropdownRef} className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={exporting}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1a1a2e] bg-white border border-[#e8e7e4] rounded-lg hover:bg-[#f9f9fb] transition-colors",
              exporting && "opacity-60 cursor-wait"
            )}
          >
            <Download size={13} />
            {exporting ? "Exporting..." : "Export"}
            <ChevronDown size={10} />
          </button>
          {exportOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[140px] bg-white border border-[#e8e7e4] rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={handleExportPDF}
                className="block w-full px-3.5 py-2 text-[13px] text-left text-[#1a1a2e] hover:bg-[#f5f5f3] transition-colors"
              >
                Export as PDF
              </button>
              <button
                onClick={handleExportPPTX}
                className="block w-full px-3.5 py-2 text-[13px] text-left text-[#1a1a2e] hover:bg-[#f5f5f3] transition-colors"
              >
                Export as PPTX
              </button>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <span className="text-[12px] font-medium text-[#95928E] tabular-nums">
          {currentSlideIdx + 1} / {slides.length}
        </span>

        <button
          onClick={resetDeckBuilder}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#6b6b80] hover:text-[#1a1a2e] bg-transparent border border-[#e8e7e4] rounded-lg hover:bg-[#f9f9fb] transition-colors"
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
