"use client";

import { useEffect, useRef, useCallback } from "react";
import { sanitizeSlideHtml, extractGoogleFontUrls, enforceSlideContrast } from "./sanitizeSlideHtml";
import { resolveImageQuery } from "@/lib/imageCache";
import type { HtmlDeckSlide } from "@/lib/types";

interface HtmlSlideRendererProps {
  slide: HtmlDeckSlide;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
  onFieldEdit?: (fieldId: string, newValue: string) => void;
  editable?: boolean;
}

const SLIDE_W = 960;
const SLIDE_H = 540;

export function HtmlSlideRenderer({
  slide,
  scale = 1,
  onClick,
  isActive,
  onFieldEdit,
  editable = false,
}: HtmlSlideRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fontsLoadedRef = useRef<Set<string>>(new Set());
  const sanitizedHtml = sanitizeSlideHtml(enforceSlideContrast(slide.html));

  // Preload Google Fonts from the HTML
  useEffect(() => {
    const urls = extractGoogleFontUrls(slide.html);
    for (const url of urls) {
      if (fontsLoadedRef.current.has(url)) continue;
      fontsLoadedRef.current.add(url);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }, [slide.html]);

  // Resolve data-image-query attributes into background images
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const els = container.querySelectorAll<HTMLElement>("[data-image-query]");
    if (els.length === 0) return;

    const promises = Array.from(els).map(async (el) => {
      const query = el.dataset.imageQuery;
      if (!query) return;
      const url = await resolveImageQuery(query);
      if (cancelled || !url) return;
      el.style.backgroundImage = `url(${url})`;
    });

    Promise.allSettled(promises);

    return () => { cancelled = true; };
  }, [sanitizedHtml]);

  // Handle click-to-edit on data-field elements
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editable || !onFieldEdit) {
        onClick?.();
        return;
      }
      const target = (e.target as HTMLElement).closest("[data-field]") as HTMLElement | null;
      if (!target) {
        onClick?.();
        return;
      }
      e.stopPropagation();
      const fieldId = target.dataset.field!;

      // Make element editable
      target.contentEditable = "true";
      target.focus();

      const handleBlur = () => {
        target.contentEditable = "false";
        target.removeEventListener("blur", handleBlur);
        onFieldEdit(fieldId, target.textContent || "");
      };
      target.addEventListener("blur", handleBlur);
    },
    [editable, onFieldEdit, onClick],
  );

  return (
    <div
      className="relative"
      style={{
        width: SLIDE_W * scale,
        height: SLIDE_H * scale,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          position: "relative",
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{ boxShadow: "inset 0 0 0 2px #d4582a" }}
        />
      )}
    </div>
  );
}
