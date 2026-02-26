"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, ChevronUp, ChevronDown, Download, Palette } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { DeckSlide, DeckTheme } from "@/lib/types";
import { SlideRenderer, SlideEditHandlers } from "./SlideRenderer";
import { deckThemes } from "./deckThemes";

export function DeckPanel() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
  const updateSlides = useAppStore((s) => s.updateDeckSlides);
  const updateTheme = useAppStore((s) => s.updateDeckTheme);

  const [activeIdx, setActiveIdx] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const activeSlide = slides[activeIdx] || null;

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showThemePicker && !showExport) return;
    const handler = (e: MouseEvent) => {
      if (showThemePicker && themeRef.current && !themeRef.current.contains(e.target as Node)) setShowThemePicker(false);
      if (showExport && exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showThemePicker, showExport]);

  const addSlide = useCallback((afterIdx: number) => {
    const newSlide: DeckSlide = { id: nanoid(), layout: "bullets", title: "New Slide", bullets: ["Point 1", "Point 2", "Point 3"] };
    const updated = [...slides];
    updated.splice(afterIdx + 1, 0, newSlide);
    updateSlides(updated);
    setActiveIdx(afterIdx + 1);
  }, [slides, updateSlides]);

  const deleteSlide = useCallback((idx: number) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== idx);
    updateSlides(updated);
    setActiveIdx(Math.min(idx, updated.length - 1));
  }, [slides, updateSlides]);

  const moveSlide = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= slides.length) return;
    const updated = [...slides];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updateSlides(updated);
    setActiveIdx(newIdx);
  }, [slides, updateSlides]);

  const updateSlide = useCallback((idx: number, updates: Partial<DeckSlide>) => {
    const updated = slides.map((s, i) => i === idx ? { ...s, ...updates } : s);
    updateSlides(updated);
  }, [slides, updateSlides]);

  const handleExport = async (format: "pdf" | "pptx") => {
    setShowExport(false);
    const { exportDeckToPDF, exportDeckToPPTX } = await import("./deckExport");
    if (format === "pdf") {
      exportDeckToPDF(slides, theme);
    } else {
      exportDeckToPPTX(slides, theme);
    }
  };

  // Clamp activeIdx
  useEffect(() => {
    if (activeIdx >= slides.length && slides.length > 0) {
      setActiveIdx(slides.length - 1);
    }
  }, [slides.length, activeIdx]);

  // Edit handlers for the active slide — memoized to avoid re-renders
  const editHandlers: SlideEditHandlers | undefined = useMemo(() => {
    if (!activeSlide) return undefined;
    return {
      onTitleChange: (value: string) => updateSlide(activeIdx, { title: value }),
      onSubtitleChange: (value: string) => updateSlide(activeIdx, { subtitle: value }),
      onContentChange: (value: string) => updateSlide(activeIdx, { content: value }),
      onBulletsChange: (bullets: string[]) => updateSlide(activeIdx, { bullets }),
    };
  }, [activeIdx, activeSlide, updateSlide]);

  return (
    <div className="flex h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      {/* Left: Slide thumbnails */}
      <div
        className="flex flex-col w-[210px] border-r overflow-y-auto flex-shrink-0"
        style={{ borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
      >
        <div className="p-3 flex flex-col gap-2.5">
          {slides.map((slide, i) => (
            <div key={slide.id} className="relative group">
              <div
                className="flex items-center gap-1 px-1"
                style={{ fontSize: 10, color: design.colors.text.muted, marginBottom: 3 }}
              >
                <span style={{ fontWeight: 600 }}>{i + 1}</span>
                <div className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                  style={{ color: design.colors.text.muted }}
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                  style={{ color: design.colors.text.muted }}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <SlideRenderer
                slide={slide}
                theme={theme}
                scale={186 / 960}
                onClick={() => setActiveIdx(i)}
                isActive={i === activeIdx}
              />
            </div>
          ))}
          <button
            onClick={() => addSlide(slides.length - 1)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed transition-colors"
            style={{ borderColor: design.colors.border.default, color: design.colors.text.muted, fontSize: 12 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = design.colors.accent.blue; e.currentTarget.style.color = design.colors.accent.blue; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; e.currentTarget.style.color = design.colors.text.muted; }}
          >
            <Plus className="w-3 h-3" />
            Add slide
          </button>
        </div>
      </div>

      {/* Center: Active slide + editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 border-b flex-shrink-0"
          style={{ height: 44, borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
        >
          <select
            value={activeSlide?.layout || "bullets"}
            onChange={(e) => activeSlide && updateSlide(activeIdx, { layout: e.target.value as DeckSlide["layout"] })}
            className="text-[12px] px-2 py-1 rounded-md border bg-transparent outline-none"
            style={{ borderColor: design.colors.border.default, color: design.colors.text.primary }}
          >
            <option value="title">Title Slide</option>
            <option value="bullets">Bullet Points</option>
            <option value="titleContent">Title + Content</option>
            <option value="twoColumn">Two Columns</option>
            <option value="section">Section Break</option>
            <option value="quote">Quote</option>
            <option value="blank">Blank</option>
          </select>

          <span className="text-[11px]" style={{ color: design.colors.text.placeholder }}>
            {activeIdx + 1} / {slides.length}
          </span>

          <div className="flex-1" />

          {/* Theme picker */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => { setShowThemePicker(!showThemePicker); setShowExport(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-colors border"
              style={{ borderColor: design.colors.border.default, color: design.colors.text.secondary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Palette className="w-3.5 h-3.5" />
              {deckThemes[theme].label}
            </button>
            {showThemePicker && (
              <div
                className="absolute right-0 top-full mt-1 border rounded-xl py-1.5 z-50 min-w-[180px]"
                style={{ backgroundColor: design.colors.bg.elevated, borderColor: design.colors.border.default, boxShadow: design.shadows.dropdown }}
              >
                {(Object.keys(deckThemes) as DeckTheme[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { updateTheme(key); setShowThemePicker(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors"
                    style={{ color: theme === key ? design.colors.brand.primary : design.colors.text.primary, fontWeight: theme === key ? 600 : 400 }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <div
                      className="w-6 h-4 rounded border flex-shrink-0"
                      style={{
                        background: deckThemes[key].bg,
                        borderColor: design.colors.border.default,
                        boxShadow: theme === key ? `0 0 0 2px ${design.colors.brand.primary}` : "none",
                      }}
                    />
                    {deckThemes[key].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => { setShowExport(!showExport); setShowThemePicker(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-colors border"
              style={{ borderColor: design.colors.border.default, color: design.colors.text.secondary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            {showExport && (
              <div
                className="absolute right-0 top-full mt-1 border rounded-xl py-1 z-50 min-w-[150px]"
                style={{ backgroundColor: design.colors.bg.elevated, borderColor: design.colors.border.default, boxShadow: design.shadows.dropdown }}
              >
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full px-3 py-1.5 text-[13px] text-left transition-colors"
                  style={{ color: design.colors.text.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Download PDF
                </button>
                <button
                  onClick={() => handleExport("pptx")}
                  className="w-full px-3 py-1.5 text-[13px] text-left transition-colors"
                  style={{ color: design.colors.text.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Download PPTX
                </button>
              </div>
            )}
          </div>

          {slides.length > 1 && (
            <button
              onClick={() => deleteSlide(activeIdx)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: design.colors.text.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(229,69,69,0.06)"; e.currentTarget.style.color = "#e54545"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = design.colors.text.muted; }}
              title="Delete slide"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Slide canvas — single SlideRenderer with edit handlers, no overlay */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-8" style={{ backgroundColor: design.colors.bg.tertiary }}>
          {activeSlide ? (
            <SlideRenderer
              slide={activeSlide}
              theme={theme}
              scale={0.75}
              edit={editHandlers}
            />
          ) : (
            <p style={{ color: design.colors.text.muted }}>No slides yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
