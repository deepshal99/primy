"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2, ImagePlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ImageResult {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt: string;
  credit: string;
  creditLink: string;
  source: string;
}

interface ImagePickerProps {
  onSelect: (url: string) => void;
  onRemove?: () => void;
  hasImage?: boolean;
}

export function ImagePicker({ onSelect, onRemove, hasImage }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const fetchImages = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchImages(value), 300);
  }, [fetchImages]);

  // Load default images on open
  useEffect(() => {
    if (open && results.length === 0 && !query) {
      fetchImages("business professional");
    }
  }, [open, results.length, query, fetchImages]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9]"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Background image</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-[380px] p-0" align="start" sideOffset={8}>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search images..."
              className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg border border-border bg-muted/50 outline-none focus:border-[#d4582a]/40 transition-colors"
              autoFocus
            />
          </div>
          {hasImage && onRemove && (
            <button
              onClick={() => { onRemove(); setOpen(false); }}
              className="flex items-center gap-1.5 mt-2 text-[11px] text-red-500 hover:text-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
              Remove background image
            </button>
          )}
        </div>

        <div className="p-2 max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-muted-foreground">
              {query ? "No images found" : "Search for images"}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {results.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => { onSelect(img.urls.regular); setOpen(false); }}
                    className="relative group rounded-lg overflow-hidden aspect-[4/3] bg-muted animate-in fade-in duration-300"
                    style={{ animationDelay: `${idx * 30}ms`, animationFillMode: "backwards" }}
                  >
                    <img
                      src={img.urls.thumb}
                      alt={img.alt}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-white/80 truncate block">
                        {img.credit}
                        {img.source !== "fallback" && (
                          <span className="text-white/50"> via {img.source === "pexels" ? "Pexels" : "Unsplash"}</span>
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground text-center mt-2 px-2">
                Photos from Unsplash & Pexels. Click to set as slide background.
              </p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
