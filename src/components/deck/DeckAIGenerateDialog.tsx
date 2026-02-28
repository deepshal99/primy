"use client";

import { useState, useCallback } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { design } from "@/lib/design";
import { DeckSlide } from "@/lib/types";
import { nanoid } from "nanoid";
import { HtmlSlideRenderer } from "./HtmlSlideRenderer";

interface DeckAIGenerateDialogProps {
  onClose: () => void;
  onApply: (slides: DeckSlide[]) => void;
}

export function DeckAIGenerateDialog({ onClose, onApply }: DeckAIGenerateDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setGeneratedSlides([]);
    setProgressCount(0);

    try {
      const res = await fetch("/api/deck-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), slideCount }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Generation failed (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "progress") {
              setProgressCount(parsed.slideCount);
            } else if (parsed.type === "complete") {
              setGeneratedSlides(parsed.slides);
            } else if (parsed.type === "error") {
              throw new Error(parsed.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [prompt, slideCount, generating]);

  const handleApply = useCallback(() => {
    const deckSlides: DeckSlide[] = generatedSlides.map((html, i) => ({
      id: nanoid(),
      layout: "html" as const,
      title: `Slide ${i + 1}`,
      html,
      htmlPrompt: prompt,
      generatedBy: "kimi" as const,
    }));
    onApply(deckSlides);
    onClose();
  }, [generatedSlides, prompt, onApply, onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl border overflow-hidden flex flex-col"
        style={{
          backgroundColor: design.colors.bg.primary,
          borderColor: design.colors.border.default,
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          width: generatedSlides.length > 0 ? 860 : 520,
          maxHeight: "85vh",
          transition: "width 0.3s ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-b"
          style={{ borderColor: design.colors.border.default }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: design.colors.accent.gold }} />
            <span className="text-[14px] font-semibold" style={{ color: design.colors.text.primary }}>
              Generate with AI
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Prompt */}
          <label className="block text-[12px] font-medium mb-1.5" style={{ color: design.colors.text.secondary }}>
            Describe your presentation
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A startup pitch deck for an AI-powered recruiting platform targeting enterprise HR teams..."
            rows={4}
            className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none resize-none mb-4"
            style={{
              borderColor: design.colors.border.default,
              backgroundColor: design.colors.bg.secondary,
              color: design.colors.text.primary,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; }}
          />

          {/* Options row */}
          <div className="flex gap-4 mb-4">
            <div className="w-[160px]">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: design.colors.text.secondary }}>
                Number of slides
              </label>
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none bg-transparent"
                style={{ borderColor: design.colors.border.default, color: design.colors.text.primary }}
              >
                {[6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n} slides</option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex items-end">
              <p className="text-[11px] pb-2" style={{ color: design.colors.text.muted }}>
                Visual style is auto-designed based on your topic
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg px-3 py-2 mb-4 text-[13px]" style={{ backgroundColor: "rgba(229,69,69,0.08)", color: "#e54545" }}>
              {error}
            </div>
          )}

          {/* Preview generated slides */}
          {(generatedSlides.length > 0 || (generating && progressCount > 0)) && (
            <div>
              <label className="block text-[12px] font-medium mb-2" style={{ color: design.colors.text.secondary }}>
                {generating ? `Generating... (${progressCount} slides so far)` : `Generated ${generatedSlides.length} slides`}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {generatedSlides.map((html, i) => (
                  <div key={i} className="relative">
                    <div className="absolute top-1 left-1 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}>
                      {i + 1}
                    </div>
                    <HtmlSlideRenderer html={html} scale={240 / 960} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-t"
          style={{ borderColor: design.colors.border.default }}
        >
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] transition-colors border"
            style={{ borderColor: design.colors.border.default, color: design.colors.text.secondary }}
          >
            Cancel
          </button>
          {generatedSlides.length > 0 ? (
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
              style={{ backgroundColor: design.colors.brand.primary, color: "#fff" }}
            >
              Apply {generatedSlides.length} slides
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: design.colors.accent.gold, color: "#fff" }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
