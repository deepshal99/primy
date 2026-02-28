"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, ChevronUp, ChevronDown, Download, Play, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer, SlideEditHandlers } from "./SlideRenderer";
import { HtmlSlideRenderer } from "./HtmlSlideRenderer";
import { resolveTheme, loadThemeFonts } from "./deckThemes";
import { PresentationMode } from "./PresentationMode";
import { DeckAIGenerateDialog } from "./DeckAIGenerateDialog";

export function DeckPanel() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
  const updateSlides = useAppStore((s) => s.updateDeckSlides);

  const [activeIdx, setActiveIdx] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const resolvedTheme = resolveTheme(theme);
  const activeSlide = slides[activeIdx] || null;

  useEffect(() => { loadThemeFonts(theme); }, [theme]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (showExport && exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExport]);

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
    if (format === "pdf") exportDeckToPDF(slides, theme);
    else exportDeckToPPTX(slides, theme);
  };

  const handleAIApply = useCallback((newSlides: DeckSlide[]) => {
    updateSlides(newSlides);
    setActiveIdx(0);
  }, [updateSlides]);

  // Clamp activeIdx
  useEffect(() => {
    if (activeIdx >= slides.length && slides.length > 0) setActiveIdx(slides.length - 1);
  }, [slides.length, activeIdx]);

  const editHandlers: SlideEditHandlers | undefined = useMemo(() => {
    if (!activeSlide || activeSlide.layout === "html") return undefined;
    return {
      onTitleChange: (value: string) => updateSlide(activeIdx, { title: value }),
      onSubtitleChange: (value: string) => updateSlide(activeIdx, { subtitle: value }),
      onContentChange: (value: string) => updateSlide(activeIdx, { content: value }),
      onBulletsChange: (bullets: string[]) => updateSlide(activeIdx, { bullets }),
      onStatsChange: (stats: { value: string; label: string }[]) => updateSlide(activeIdx, { stats }),
    };
  }, [activeIdx, activeSlide, updateSlide]);

  const isHtmlSlide = activeSlide?.layout === "html" && activeSlide.html;

  return (
    <div className="flex h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      {/* Left: Slide thumbnails */}
      <div
        className="flex flex-col w-[180px] border-r overflow-y-auto flex-shrink-0"
        style={{ borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
      >
        <div className="p-2.5 flex flex-col gap-2">
          {slides.map((slide, i) => (
            <div key={slide.id} className="relative group">
              <div
                className="flex items-center gap-1 px-0.5"
                style={{ fontSize: 10, color: design.colors.text.muted, marginBottom: 2 }}
              >
                <span style={{ fontWeight: 600 }}>{i + 1}</span>
                {slide.layout === "html" && (
                  <span className="text-[8px] px-1 rounded" style={{ backgroundColor: design.colors.accent.goldSubtle, color: design.colors.accent.gold }}>AI</span>
                )}
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
              {slide.layout === "html" && slide.html ? (
                <HtmlSlideRenderer
                  html={slide.html}
                  scale={160 / 960}
                  onClick={() => setActiveIdx(i)}
                  isActive={i === activeIdx}
                />
              ) : (
                <SlideRenderer
                  slide={slide}
                  theme={resolvedTheme}
                  scale={160 / 960}
                  onClick={() => setActiveIdx(i)}
                  isActive={i === activeIdx}
                />
              )}
            </div>
          ))}
          <button
            onClick={() => addSlide(slides.length - 1)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed transition-colors"
            style={{ borderColor: design.colors.border.default, color: design.colors.text.muted, fontSize: 11 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = design.colors.accent.blue; e.currentTarget.style.color = design.colors.accent.blue; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; e.currentTarget.style.color = design.colors.text.muted; }}
          >
            <Plus className="w-3 h-3" />
            Add slide
          </button>
        </div>
      </div>

      {/* Center: Active slide + editor */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar — compact single row */}
        <div
          className="flex items-center gap-1.5 px-3 border-b flex-shrink-0"
          style={{ height: 40, borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
        >
          {/* Layout selector (non-HTML slides only) */}
          {activeSlide && activeSlide.layout !== "html" && (
            <select
              value={activeSlide.layout}
              onChange={(e) => updateSlide(activeIdx, { layout: e.target.value as DeckSlide["layout"] })}
              className="text-[11px] px-1.5 py-0.5 rounded border bg-transparent outline-none"
              style={{ borderColor: design.colors.border.default, color: design.colors.text.primary }}
            >
              <option value="title">Title</option>
              <option value="bullets">Bullets</option>
              <option value="titleContent">Content</option>
              <option value="twoColumn">Two Col</option>
              <option value="section">Section</option>
              <option value="quote">Quote</option>
              <option value="stats">Stats</option>
              <option value="blank">Blank</option>
            </select>
          )}

          <span className="text-[10px] tabular-nums" style={{ color: design.colors.text.muted }}>
            {activeIdx + 1}/{slides.length}
          </span>

          <div className="flex-1" />

          {/* AI Generate */}
          <button
            onClick={() => setShowAIDialog(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors"
            style={{ color: design.colors.accent.gold }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.accent.goldSubtle; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            title="Generate with AI"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI</span>
          </button>

          {/* Present */}
          <button
            onClick={() => setShowPresentation(true)}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            title="Present"
          >
            <Play className="w-3.5 h-3.5" fill="currentColor" />
          </button>

          {/* Export */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: design.colors.text.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              title="Export"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {showExport && (
              <div
                className="absolute right-0 top-full mt-1 border rounded-xl py-1 z-50 min-w-[130px]"
                style={{ backgroundColor: design.colors.bg.elevated, borderColor: design.colors.border.default, boxShadow: design.shadows.dropdown }}
              >
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full px-3 py-1.5 text-[12px] text-left transition-colors"
                  style={{ color: design.colors.text.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  PDF
                </button>
                <button
                  onClick={() => handleExport("pptx")}
                  className="w-full px-3 py-1.5 text-[12px] text-left transition-colors"
                  style={{ color: design.colors.text.primary }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  PPTX
                </button>
              </div>
            )}
          </div>

          {/* Delete */}
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

        {/* Slide canvas — auto-scale to fit available space */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4" style={{ backgroundColor: design.colors.bg.tertiary }}>
          {activeSlide ? (
            isHtmlSlide ? (
              <HtmlSlideRenderer html={activeSlide.html!} scale={0.55} />
            ) : (
              <SlideRenderer
                slide={activeSlide}
                theme={resolvedTheme}
                scale={0.55}
                edit={editHandlers}
              />
            )
          ) : (
            <p className="text-[12px]" style={{ color: design.colors.text.muted }}>No slides yet</p>
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

      {/* AI Generate dialog */}
      {showAIDialog && (
        <DeckAIGenerateDialog
          onClose={() => setShowAIDialog(false)}
          onApply={handleAIApply}
        />
      )}
    </div>
  );
}
