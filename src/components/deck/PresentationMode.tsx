"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer } from "./SlideRenderer";
import { HtmlSlideRenderer } from "./HtmlSlideRenderer";
import { resolveTheme } from "./deckThemes";

interface PresentationModeProps {
  slides: DeckSlide[];
  theme: string;
  startIdx?: number;
  onExit: () => void;
}

export function PresentationMode({ slides, theme, startIdx = 0, onExit }: PresentationModeProps) {
  const [currentIdx, setCurrentIdx] = useState(startIdx);
  const [showCounter, setShowCounter] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedTheme = resolveTheme(theme);

  const goNext = useCallback(() => {
    if (currentIdx < slides.length - 1) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIdx((prev) => Math.min(prev + 1, slides.length - 1));
        setTransitioning(false);
      }, 150);
    }
  }, [currentIdx, slides.length]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentIdx((prev) => Math.max(prev - 1, 0));
        setTransitioning(false);
      }, 150);
    }
  }, [currentIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "Enter":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
        case "c":
        case "C":
          setShowCounter((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onExit]);

  // Request fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen denied - still works as overlay
      });
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Exit on fullscreen change (user pressed Esc via browser)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && containerRef.current) {
        // Small delay to avoid double-firing with Escape key handler
        setTimeout(() => onExit(), 50);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [onExit]);

  const slide = slides[currentIdx];
  if (!slide) return null;

  const isHtml = slide.layout === "html" && slide.html;

  // Calculate scale to fit 960x540 in viewport with 16:9 maintained
  const content = (
    <div
      ref={containerRef}
      onClick={goNext}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "none",
      }}
    >
      {/* Slide with fade transition */}
      <div
        style={{
          opacity: transitioning ? 0 : 1,
          transition: "opacity 0.15s ease-in-out",
          // Scale to fit viewport
          transform: `scale(${Math.min(
            (typeof window !== "undefined" ? window.innerWidth : 1920) / 960,
            (typeof window !== "undefined" ? window.innerHeight : 1080) / 540
          )})`,
        }}
      >
        {isHtml ? (
          <HtmlSlideRenderer html={slide.html!} scale={1} />
        ) : (
          <SlideRenderer slide={slide} theme={resolvedTheme} scale={1} />
        )}
      </div>

      {/* Slide counter */}
      {showCounter && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 24,
            color: "rgba(255,255,255,0.5)",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {currentIdx + 1} / {slides.length}
        </div>
      )}

      {/* Navigation hint (fades after 3s) */}
      <NavigationHint />
    </div>
  );

  return createPortal(content, document.body);
}

function NavigationHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
        userSelect: "none",
        transition: "opacity 0.5s",
      }}
    >
      Arrow keys or click to navigate &middot; Esc to exit &middot; C to toggle counter
    </div>
  );
}
