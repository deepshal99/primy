"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { DeckSlide } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DeckAIGenerateDialogProps {
  onClose: () => void;
  onApply: (slides: DeckSlide[]) => void;
}

export function DeckAIGenerateDialog({ onClose }: DeckAIGenerateDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      // Dispatch the prompt to the chat system via custom event
      const deckPrompt = `Create a professional presentation deck with ${slideCount} slides about: ${prompt.trim()}

Make sure the slides follow a compelling narrative arc. Use the most fitting theme for the topic. Include imageQuery for title and closing slides.`;

      window.dispatchEvent(new CustomEvent("drafta:send-message", { detail: { content: deckPrompt } }));
      onClose();
    } catch (err: any) {
      setError(err.message || "Generation failed");
      setGenerating(false);
    }
  }, [prompt, slideCount, generating, onClose]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Sparkles className="w-4 h-4 text-[#d4582a]" />
            Generate Presentation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Prompt */}
          <div>
            <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
              Describe your presentation
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A startup pitch deck for an AI-powered recruiting platform targeting enterprise HR teams..."
              rows={4}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-[13px] outline-none resize-none bg-muted/30 focus:border-[#d4582a]/40 transition-colors placeholder:text-muted-foreground"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Number of slides
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[120px] justify-between text-[13px] h-9">
                    {slideCount} slides
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[6, 8, 10, 12].map((n) => (
                    <DropdownMenuItem key={n} onClick={() => setSlideCount(n)} className="text-[13px]">
                      {n} slides
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex-1 flex items-end pb-0.5">
              <p className="text-[11px] text-muted-foreground">
                Theme and images are auto-selected based on your topic
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg px-3 py-2 text-[13px] bg-red-50 text-red-600 border border-red-100">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-[13px]">
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="text-[13px] bg-[#d4582a] hover:bg-[#c04d24] text-white"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
