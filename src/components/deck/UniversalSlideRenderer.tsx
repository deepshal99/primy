"use client";

import { isHtmlSlide } from "@/lib/types";
import type { DeckSlide, HtmlDeckSlide, ThemeConfig } from "@/lib/types";
import { HtmlSlideRenderer } from "./HtmlSlideRenderer";
import { LegacySlideRenderer } from "./LegacySlideRenderer";

interface UniversalSlideRendererProps {
  slide: DeckSlide | HtmlDeckSlide;
  theme?: string;
  themeConfig?: ThemeConfig | null;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
  editable?: boolean;
  onFieldEdit?: (fieldId: string, newValue: string) => void;
}

export function UniversalSlideRenderer({
  slide,
  theme = "pitch",
  themeConfig,
  scale = 1,
  onClick,
  isActive,
  editable,
  onFieldEdit,
}: UniversalSlideRendererProps) {
  if (isHtmlSlide(slide)) {
    return (
      <HtmlSlideRenderer
        slide={slide}
        scale={scale}
        onClick={onClick}
        isActive={isActive}
        editable={editable}
        onFieldEdit={onFieldEdit}
      />
    );
  }

  // Old structured slide format — use legacy renderer
  return (
    <LegacySlideRenderer
      slide={slide}
      theme={theme}
      themeConfig={themeConfig}
      scale={scale}
      onClick={onClick}
      isActive={isActive}
    />
  );
}
