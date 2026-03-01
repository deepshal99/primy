"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { nanoid } from "nanoid";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Copy, StickyNote,
  LayoutTemplate, Palette, GripVertical,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { DeckSlide } from "@/lib/types";
import { SlideRenderer, SlideEditHandlers } from "./SlideRenderer";
import { resolveTheme, loadThemeFonts, deckThemes, activeThemeKeys, getThemeConfig } from "./deckThemes";
import { PresentationMode } from "./PresentationMode";
import { DeckAIGenerateDialog } from "./DeckAIGenerateDialog";
import { ImagePicker } from "./ImagePicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LAYOUT_OPTIONS: { value: DeckSlide["layout"]; label: string; icon: string }[] = [
  { value: "title", label: "Title", icon: "T" },
  { value: "bullets", label: "Bullets", icon: "•" },
  { value: "titleContent", label: "Content", icon: "¶" },
  { value: "twoColumn", label: "Two Column", icon: "‖" },
  { value: "section", label: "Section", icon: "§" },
  { value: "quote", label: "Quote", icon: "\"" },
  { value: "stats", label: "Stats", icon: "#" },
  { value: "imageFeature", label: "Image Hero", icon: "◻" },
  { value: "blank", label: "Blank", icon: "□" },
];

export function DeckPanel() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);
  const updateSlides = useAppStore((s) => s.updateDeckSlides);

  const [activeIdx, setActiveIdx] = useState(0);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const resolvedTheme = resolveTheme(theme);
  const activeSlide = slides[activeIdx] || null;

  useEffect(() => { loadThemeFonts(theme); }, [theme]);

  // Listen for custom events from DeckActions in TabBar
  useEffect(() => {
    const handlePresent = () => setShowPresentation(true);
    const handleAI = () => setShowAIDialog(true);
    window.addEventListener("drafta:deck-present", handlePresent);
    window.addEventListener("drafta:deck-ai", handleAI);
    return () => {
      window.removeEventListener("drafta:deck-present", handlePresent);
      window.removeEventListener("drafta:deck-ai", handleAI);
    };
  }, []);

  const addSlide = useCallback((afterIdx: number) => {
    const newSlide: DeckSlide = { id: nanoid(), layout: "bullets", title: "New Slide", bullets: ["Point 1", "Point 2", "Point 3"] };
    const updated = [...slides];
    updated.splice(afterIdx + 1, 0, newSlide);
    updateSlides(updated);
    setActiveIdx(afterIdx + 1);
  }, [slides, updateSlides]);

  const duplicateSlide = useCallback((idx: number) => {
    const original = slides[idx];
    if (!original) return;
    const dup: DeckSlide = { ...JSON.parse(JSON.stringify(original)), id: nanoid() };
    const updated = [...slides];
    updated.splice(idx + 1, 0, dup);
    updateSlides(updated);
    setActiveIdx(idx + 1);
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

  const handleAIApply = useCallback((newSlides: DeckSlide[]) => {
    updateSlides(newSlides);
    setActiveIdx(0);
  }, [updateSlides]);

  // Drag-to-reorder handlers
  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...slides];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(targetIdx, 0, moved);
    updateSlides(updated);
    setActiveIdx(targetIdx);
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, slides, updateSlides]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

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

  return (
    <div className="flex h-full bg-background">
      {/* Left: Slide thumbnails */}
      <div className="flex flex-col w-[190px] border-r border-border flex-shrink-0 bg-[#fafaf9]">
        <ScrollArea className="flex-1">
          <div className="p-2.5 flex flex-col gap-2.5">
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={cn(
                  "relative group rounded-xl transition-all",
                  dragOverIdx === i && dragIdx !== i && "ring-2 ring-[#d4582a]/40",
                )}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
              >
                {/* Slide number badge + hover controls */}
                <div className="flex items-center gap-1 px-1 mb-1">
                  <div className="flex items-center gap-1">
                    <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0 h-4 font-semibold border transition-colors",
                        i === activeIdx
                          ? "border-[#d4582a]/40 text-[#d4582a] bg-[#d4582a]/5"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </Badge>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateSlide(i); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">Duplicate</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">Move up</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">Move down</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                {/* Slide thumbnail */}
                <div
                  className={cn(
                    "rounded-lg overflow-hidden ring-1 transition-all cursor-pointer",
                    i === activeIdx
                      ? "ring-[#d4582a] shadow-md"
                      : "ring-border/50 hover:ring-border"
                  )}
                >
                  <SlideRenderer
                    slide={slide}
                    theme={resolvedTheme}
                    scale={170 / 960}
                    onClick={() => setActiveIdx(i)}
                    isActive={false}
                  />
                </div>
              </div>
            ))}

            {/* Add slide button */}
            <button
              onClick={() => addSlide(slides.length - 1)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground text-[11px] font-medium transition-colors hover:border-[#d4582a]/40 hover:text-[#d4582a] hover:bg-[#d4582a]/5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add slide
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* Center: Active slide + editor */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 border-b border-border flex-shrink-0 h-11 bg-[#fafaf9]">
          {activeSlide && activeSlide.layout !== "html" && (
            <>
              {/* Layout selector */}
              <DropdownMenu>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[12px] font-medium transition-colors text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9]">
                          <LayoutTemplate className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{LAYOUT_OPTIONS.find(l => l.value === activeSlide.layout)?.label || "Layout"}</span>
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Slide layout</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="start" className="w-[180px]">
                  {LAYOUT_OPTIONS.filter(l => l.value !== "html").map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => updateSlide(activeIdx, { layout: opt.value })}
                      className={cn(
                        "flex items-center gap-2 text-[12px]",
                        activeSlide.layout === opt.value && "bg-accent"
                      )}
                    >
                      <span className="w-5 text-center font-mono text-[14px] text-muted-foreground">{opt.icon}</span>
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme picker */}
              <ThemePicker currentTheme={resolvedTheme} />

              <div className="w-px h-5 bg-border mx-1" />

              {/* Image picker */}
              <ImagePicker
                onSelect={(url) => updateSlide(activeIdx, { backgroundImage: url })}
                onRemove={() => updateSlide(activeIdx, { backgroundImage: undefined, backgroundOverlay: undefined })}
                hasImage={!!activeSlide.backgroundImage}
              />

              {/* Speaker notes toggle */}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowNotes(!showNotes)}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                        showNotes ? "text-[#d4582a] bg-[#d4582a]/10" : "text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9]"
                      )}
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Speaker notes</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          <div className="flex-1" />

          <span className="text-[10px] tabular-nums text-muted-foreground mr-1">
            {activeIdx + 1}/{slides.length}
          </span>

          {slides.length > 1 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => deleteSlide(activeIdx)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete slide</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-[#f4f3f0]">
          {activeSlide ? (
            <SlideRenderer
              slide={activeSlide}
              theme={resolvedTheme}
              scale={0.55}
              edit={editHandlers}
            />
          ) : (
            <p className="text-xs text-muted-foreground">No slides yet</p>
          )}
        </div>

        {/* Notes panel */}
        {showNotes && activeSlide && (
          <div className="border-t border-border bg-[#fafaf9] px-4 py-3 flex-shrink-0">
            <textarea
              value={activeSlide.notes || ""}
              onChange={(e) => updateSlide(activeIdx, { notes: e.target.value })}
              placeholder="Add speaker notes..."
              className="w-full h-20 text-[13px] bg-transparent border border-border rounded-lg px-3 py-2 outline-none resize-none focus:border-[#d4582a]/40 transition-colors text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
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

/* ━━ Theme Picker Popover ━━ */
function ThemePicker({ currentTheme }: { currentTheme: string }) {
  const setTheme = useAppStore((s) => s.updateDeckTheme);

  return (
    <Popover>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[12px] font-medium transition-colors text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9]">
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{deckThemes[currentTheme]?.label || "Theme"}</span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Slide theme</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-[260px] p-3" align="start" sideOffset={8}>
        <p className="text-[11px] font-medium text-muted-foreground mb-2">Choose theme</p>
        <div className="grid grid-cols-4 gap-2">
          {activeThemeKeys.map((key) => {
            const t = deckThemes[key];
            const isActive = key === currentTheme;
            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all border",
                  isActive
                    ? "border-[#d4582a] bg-[#d4582a]/5"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-border/50"
                    style={{ background: t.accent }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-border/50"
                    style={{ background: t.bg.startsWith("linear") ? t.bg : t.bg }}
                  />
                </div>
                <span className="text-[9px] font-medium text-muted-foreground truncate w-full text-center">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
