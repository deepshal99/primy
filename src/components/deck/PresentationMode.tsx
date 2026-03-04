"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { DeckSlide, HtmlDeckSlide, ThemeConfig } from "@/lib/types";
import { UniversalSlideRenderer } from "./UniversalSlideRenderer";
import { resolveTheme, loadThemeFonts, loadThemeFontsFromConfig } from "./deckThemes";

interface PresentationModeProps {
  slides: (DeckSlide | HtmlDeckSlide)[];
  theme: string;
  style?: ThemeConfig | null;
  startIdx?: number;
  onExit: () => void;
}

type NavDirection = "forward" | "backward";

export function PresentationMode({ slides, theme, style, startIdx = 0, onExit }: PresentationModeProps) {
  const [currentIdx, setCurrentIdx] = useState(startIdx);
  const [showCounter, setShowCounter] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");
  const [animating, setAnimating] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const uiTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resolvedTheme = resolveTheme(theme);

  // Load theme fonts
  useEffect(() => {
    if (style) {
      loadThemeFontsFromConfig(style);
    } else {
      loadThemeFonts(theme);
    }
  }, [theme, style]);

  // Auto-hide UI after 3s of inactivity
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  // Auto-hide cursor after 2s of no movement
  const resetCursorTimer = useCallback(() => {
    setCursorHidden(false);
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => setCursorHidden(true), 2000);
  }, []);

  // Show hint briefly on keypress
  const flashHint = useCallback(() => {
    setShowHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowHint(false), 3000);
  }, []);

  // Initial UI hide timer
  useEffect(() => {
    resetUITimer();
    resetCursorTimer();
    const hintTimer = setTimeout(() => setShowHint(false), 3000);
    return () => {
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      clearTimeout(hintTimer);
    };
  }, [resetUITimer, resetCursorTimer]);

  const goNext = useCallback(() => {
    if (animating || currentIdx >= slides.length - 1) return;
    setNavDirection("forward");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIdx((prev) => Math.min(prev + 1, slides.length - 1));
      setAnimating(false);
    }, 200);
    resetUITimer();
  }, [currentIdx, slides.length, animating, resetUITimer]);

  const goPrev = useCallback(() => {
    if (animating || currentIdx <= 0) return;
    setNavDirection("backward");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIdx((prev) => Math.max(prev - 1, 0));
      setAnimating(false);
    }, 200);
    resetUITimer();
  }, [currentIdx, animating, resetUITimer]);

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
          flashHint();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          goPrev();
          flashHint();
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
        case "c":
        case "C":
          setShowCounter((prev) => !prev);
          resetUITimer();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onExit, flashHint, resetUITimer]);

  // Mouse move handler for cursor and UI visibility
  useEffect(() => {
    const handler = () => {
      resetCursorTimer();
      resetUITimer();
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [resetCursorTimer, resetUITimer]);

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
        setTimeout(() => onExit(), 50);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [onExit]);

  // Click navigation: left third = prev, right two-thirds = next
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const threshold = rect.width / 3;
      if (x < threshold) {
        goPrev();
      } else {
        goNext();
      }
    },
    [goNext, goPrev]
  );

  const slide = slides[currentIdx];
  if (!slide) return null;

  const progress = ((currentIdx + 1) / slides.length) * 100;
  const translateX = navDirection === "forward" ? 20 : -20;

  const content = (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: cursorHidden ? "none" : "default",
        overflow: "hidden",
      }}
    >
      {/* Vignette background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Slide with directional transition */}
      <div
        style={{
          opacity: animating ? 0 : 1,
          transform: animating
            ? `scale(${Math.min(
                (typeof window !== "undefined" ? window.innerWidth : 1920) / 960,
                (typeof window !== "undefined" ? window.innerHeight : 1080) / 540
              )}) translateX(${translateX}px)`
            : `scale(${Math.min(
                (typeof window !== "undefined" ? window.innerWidth : 1920) / 960,
                (typeof window !== "undefined" ? window.innerHeight : 1080) / 540
              )})`,
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
        }}
      >
        <UniversalSlideRenderer slide={slide} theme={resolvedTheme} themeConfig={style} scale={1} />
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          opacity: showUI ? 1 : 0,
          transition: "opacity 300ms ease",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: "rgba(212, 88, 42, 0.8)",
            transition: "width 300ms ease",
          }}
        />
      </div>

      {/* Slide counter - pill badge */}
      {showCounter && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 20,
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 9999,
            padding: "4px 12px",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            fontFamily: "system-ui, sans-serif",
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
            userSelect: "none",
            opacity: showUI ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          {currentIdx + 1} / {slides.length}
        </div>
      )}

      {/* Navigation hint */}
      <NavigationHint visible={showHint} />
    </div>
  );

  return createPortal(content, document.body);
}

function NavigationHint({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 9999,
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        pointerEvents: "none",
        userSelect: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 500ms ease",
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <kbd style={kbdStyle}>&larr;</kbd>
        <kbd style={kbdStyle}>&rarr;</kbd>
      </span>
      <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.2)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <kbd style={kbdStyle}>ESC</kbd>
      </span>
      <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.2)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <kbd style={kbdStyle}>C</kbd>
      </span>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  fontSize: 10,
  fontFamily: "system-ui, sans-serif",
  lineHeight: "16px",
  color: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  letterSpacing: 0.5,
};
