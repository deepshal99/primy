"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer } from "./SlideRenderer";
import { PresentationMode } from "./PresentationMode";
import { resolveTheme, loadThemeFonts } from "./deckThemes";

interface DeckViewReadOnlyProps {
  slides: DeckSlide[];
  theme: string;
}

export function DeckViewReadOnly({ slides, theme }: DeckViewReadOnlyProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showPresentation, setShowPresentation] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    loadThemeFonts(theme);
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <p className="text-[13px] text-[#95928E]">
          No slides in this presentation
        </p>
      </div>
    );
  }

  const activeSlide = slides[activeIdx];

  return (
    <div className={`flex h-full bg-[#fafaf8] transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Left: Slide thumbnails */}
      <div className="flex flex-col w-[210px] border-r border-[#e8e7e4] overflow-y-auto flex-shrink-0 bg-[#fafaf9]">
        <div className="p-3 flex flex-col gap-2.5">
          {slides.map((slide, i) => (
            <div key={slide.id || i} className="relative group">
              <div className="flex items-center gap-1 px-1 mb-[3px]">
                <span className="text-[10px] font-semibold text-[#95928E]">{i + 1}</span>
                <div className="flex-1" />
              </div>
              <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-lg">
                <SlideRenderer
                  slide={slide}
                  theme={resolvedTheme}
                  scale={186 / 960}
                  onClick={() => setActiveIdx(i)}
                  isActive={i === activeIdx}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Active slide */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 border-b border-[#e8e7e4] flex-shrink-0 h-11 bg-[#fafaf9]">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="p-1 rounded text-[#6b6b80] disabled:opacity-30 transition-all duration-150 hover:bg-[#efeee9] active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] tabular-nums text-[#95928E] font-medium">
              {activeIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() => setActiveIdx(Math.min(slides.length - 1, activeIdx + 1))}
              disabled={activeIdx === slides.length - 1}
              className="p-1 rounded text-[#6b6b80] disabled:opacity-30 transition-all duration-150 hover:bg-[#efeee9] active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-4 mx-1 bg-[#e8e7e4]" />
            <button
              onClick={() => setShowPresentation(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all duration-150 bg-[#d4582a] text-white hover:bg-[#c04d25] active:scale-95"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Present
            </button>
          </div>
        </div>

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-[#f4f3f0]">
          {activeSlide && (
            <SlideRenderer
              slide={activeSlide}
              theme={resolvedTheme}
              scale={0.75}
            />
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
