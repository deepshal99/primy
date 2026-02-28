"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer } from "./SlideRenderer";
import { HtmlSlideRenderer } from "./HtmlSlideRenderer";
import { PresentationMode } from "./PresentationMode";
import { resolveTheme, loadThemeFonts } from "./deckThemes";
import { design } from "@/lib/design";

interface DeckViewReadOnlyProps {
  slides: DeckSlide[];
  theme: string;
}

export function DeckViewReadOnly({ slides, theme }: DeckViewReadOnlyProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showPresentation, setShowPresentation] = useState(false);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    loadThemeFonts(theme);
  }, [theme]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setActiveIdx((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  if (!slides || slides.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
          No slides in this presentation
        </p>
      </div>
    );
  }

  const activeSlide = slides[activeIdx];
  const isHtml = activeSlide?.layout === "html" && activeSlide.html;

  return (
    <div className="flex h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      {/* Left: Slide thumbnails */}
      <div
        className="flex flex-col w-[210px] border-r overflow-y-auto flex-shrink-0"
        style={{ borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
      >
        <div className="p-3 flex flex-col gap-2.5">
          {slides.map((slide, i) => (
            <div key={slide.id || i} className="relative">
              <div
                className="flex items-center gap-1 px-1"
                style={{ fontSize: 10, color: design.colors.text.muted, marginBottom: 3 }}
              >
                <span style={{ fontWeight: 600 }}>{i + 1}</span>
                <div className="flex-1" />
                {slide.layout === "html" && (
                  <span className="text-[8px] px-1 rounded" style={{ backgroundColor: design.colors.accent.goldSubtle, color: design.colors.accent.gold }}>
                    AI
                  </span>
                )}
              </div>
              {slide.layout === "html" && slide.html ? (
                <HtmlSlideRenderer
                  html={slide.html}
                  scale={186 / 960}
                  onClick={() => setActiveIdx(i)}
                  isActive={i === activeIdx}
                />
              ) : (
                <SlideRenderer
                  slide={slide}
                  theme={resolvedTheme}
                  scale={186 / 960}
                  onClick={() => setActiveIdx(i)}
                  isActive={i === activeIdx}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center: Active slide */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ height: 44, borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
        >
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="p-1 rounded disabled:opacity-30 transition-colors"
              style={{ color: design.colors.text.secondary }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] tabular-nums" style={{ color: design.colors.text.muted }}>
              {activeIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() => setActiveIdx(Math.min(slides.length - 1, activeIdx + 1))}
              disabled={activeIdx === slides.length - 1}
              className="p-1 rounded disabled:opacity-30 transition-colors"
              style={{ color: design.colors.text.secondary }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-4 mx-1" style={{ backgroundColor: design.colors.border.default }} />
            <button
              onClick={() => setShowPresentation(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-colors"
              style={{ backgroundColor: design.colors.brand.primary, color: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.dark; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.primary; }}
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Present
            </button>
          </div>
        </div>

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-8" style={{ backgroundColor: design.colors.bg.tertiary }}>
          {activeSlide && (
            isHtml ? (
              <HtmlSlideRenderer html={activeSlide.html!} scale={0.75} />
            ) : (
              <SlideRenderer
                slide={activeSlide}
                theme={resolvedTheme}
                scale={0.75}
              />
            )
          )}
        </div>
      </div>

      {/* Presentation mode */}
      {showPresentation && (
        <PresentationMode
          slides={slides}
          theme={theme}
          startIdx={activeIdx}
          onExit={() => setShowPresentation(false)}
        />
      )}
    </div>
  );
}
