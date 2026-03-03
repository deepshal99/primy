"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer, SlideEditHandlers } from "./SlideRenderer";
import { PresentationMode } from "./PresentationMode";
import { exportDeckToPDF, exportDeckToPPTX } from "./deckExport";

const DECK_COLOR = "#d4582a";
const BORDER_COLOR = "#e8e7e4";
const TEXT_PRIMARY = "#1a1a2e";
const TEXT_MUTED = "#6b6b80";
const TEXT_SUBTLE = "#95928E";

export function DeckLinearView() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
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
            if (!isNaN(idx)) {
              setCurrentSlideIdx(idx);
            }
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-40% 0px -40% 0px",
        threshold: 0,
      }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [slides.length]);

  const makeEditHandlers = useCallback(
    (idx: number): SlideEditHandlers => ({
      onTitleChange: (value: string) => {
        const newSlides = slides.map((s, i) => (i === idx ? { ...s, title: value } : s));
        updateDeckSlides(newSlides);
      },
      onSubtitleChange: (value: string) => {
        const newSlides = slides.map((s, i) => (i === idx ? { ...s, subtitle: value } : s));
        updateDeckSlides(newSlides);
      },
      onContentChange: (value: string) => {
        const newSlides = slides.map((s, i) => (i === idx ? { ...s, content: value } : s));
        updateDeckSlides(newSlides);
      },
      onBulletsChange: (bullets: string[]) => {
        const newSlides = slides.map((s, i) => (i === idx ? { ...s, bullets } : s));
        updateDeckSlides(newSlides);
      },
      onStatsChange: (stats: { value: string; label: string }[]) => {
        const newSlides = slides.map((s, i) => (i === idx ? { ...s, stats } : s));
        updateDeckSlides(newSlides);
      },
    }),
    [slides, updateDeckSlides]
  );

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      await exportDeckToPDF(slides, theme);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [slides, theme]);

  const handleExportPPTX = useCallback(async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      await exportDeckToPPTX(slides, theme);
    } catch (err) {
      console.error("PPTX export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [slides, theme]);

  if (!slides.length) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: TEXT_MUTED,
          fontFamily: "system-ui, sans-serif",
          gap: 12,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={TEXT_SUBTLE} strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <div style={{ fontSize: 16, fontWeight: 500 }}>No slides yet</div>
        <div style={{ fontSize: 13, color: TEXT_SUBTLE }}>
          Generate a presentation to get started
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Sticky toolbar */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: `1px solid ${BORDER_COLOR}`,
          backgroundColor: "#fff",
          zIndex: 10,
        }}
      >
        {/* Present button */}
        <button
          onClick={() => setPresenting(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            backgroundColor: DECK_COLOR,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Present
        </button>

        {/* Export dropdown */}
        <div ref={exportDropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={exporting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: 6,
              cursor: exporting ? "wait" : "pointer",
              fontFamily: "system-ui, sans-serif",
              opacity: exporting ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {exporting ? "Exporting..." : "Export"}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {exportOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                minWidth: 140,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              <button
                onClick={handleExportPDF}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  fontSize: 13,
                  fontFamily: "system-ui, sans-serif",
                  color: TEXT_PRIMARY,
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Export as PDF
              </button>
              <button
                onClick={handleExportPPTX}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  fontSize: 13,
                  fontFamily: "system-ui, sans-serif",
                  color: TEXT_PRIMARY,
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Export as PPTX
              </button>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Slide counter */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: TEXT_MUTED,
            fontFamily: "system-ui, sans-serif",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {currentSlideIdx + 1} / {slides.length}
        </span>

        {/* Regenerate button */}
        <button
          onClick={resetDeckBuilder}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 500,
            color: TEXT_MUTED,
            backgroundColor: "transparent",
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9f9fb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Regenerate
        </button>
      </div>

      {/* Scrollable slide list */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 16px",
          backgroundColor: "#f9f9fb",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {slides.map((slide, idx) => (
            <div
              key={idx}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-slide-idx={idx}
              style={{
                borderRadius: 10,
                border: `1px solid ${BORDER_COLOR}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02)",
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {/* Slide number badge */}
              <div
                style={{
                  padding: "6px 12px",
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT_SUBTLE,
                    fontFamily: "system-ui, sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Slide {idx + 1}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: TEXT_SUBTLE,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {slide.layout}
                </span>
              </div>
              {/* Slide content */}
              <div style={{ display: "flex", justifyContent: "center", padding: 16, backgroundColor: "#fafafa" }}>
                <SlideRenderer
                  slide={slide}
                  theme={theme}
                  scale={0.85}
                  edit={makeEditHandlers(idx)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Presentation mode */}
      {presenting && (
        <PresentationMode
          slides={slides}
          theme={theme}
          startIdx={currentSlideIdx}
          onExit={() => setPresenting(false)}
        />
      )}
    </div>
  );
}
