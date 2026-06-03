"use client";

import { useEffect, useMemo, useRef } from "react";
import { DeckSlide, HtmlDeckSlide, isHtmlSlide } from "@/lib/types";
import type { ThemeConfig } from "@/lib/types";
import { getThemeConfig, loadThemeFonts, loadThemeFontsFromConfig } from "./deckThemes";
import { sanitizeSlideHtml, enforceSlideContrast } from "./sanitizeSlideHtml";

/**
 * Render raw slide HTML inside a shadow root so its CSS can't leak into the app
 * shell (`:root`, bare `body`/`h1` selectors stay contained). @font-face rules
 * loaded in document <head> still apply inside the shadow tree.
 */
function ShadowSlide({ html, style }: { html: string; style: React.CSSProperties }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) shadowRef.current = host.attachShadow({ mode: "open" });
    shadowRef.current.innerHTML = html;
  }, [html]);
  return <div ref={hostRef} style={style} />;
}

export interface SlideEditHandlers {
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onBulletsChange: (bullets: string[]) => void;
  onStatsChange?: (stats: { value: string; label: string }[]) => void;
}

interface SlideRendererProps {
  slide: DeckSlide | HtmlDeckSlide;
  theme: string;
  themeConfig?: ThemeConfig | null;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
  edit?: SlideEditHandlers;
}

/* ━━ Typography constants ━━ */
const TYPE = {
  display:    { size: 56, weight: 700, spacing: "-0.03em", lineHeight: 1.1 },
  heading:    { size: 38, weight: 600, spacing: "-0.02em", lineHeight: 1.15 },
  subheading: { size: 22, weight: 500, spacing: "-0.01em", lineHeight: 1.3 },
  body:       { size: 18, weight: 400, spacing: "0",       lineHeight: 1.6 },
  label:      { size: 13, weight: 500, spacing: "0.05em",  lineHeight: 1.4 },
  bigNumber:  { size: 64, weight: 700, spacing: "-0.03em", lineHeight: 1.0 },
} as const;

/* ━━ Spacing constants ━━ */
const PAD = { v: 64, h: 80 };
const GAP = { section: 32, element: 24 };

export function SlideRenderer({ slide, theme, themeConfig, scale = 1, onClick, isActive, edit }: SlideRendererProps) {
  const t = themeConfig || getThemeConfig(theme);

  useEffect(() => {
    if (themeConfig) {
      loadThemeFontsFromConfig(themeConfig);
    } else {
      loadThemeFonts(theme);
    }
  }, [theme, themeConfig]);

  // Handle new HTML/CSS slides — render raw HTML in a scaled container
  if (isHtmlSlide(slide)) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden select-none ${onClick ? "cursor-pointer" : ""}`}
        style={{
          width: 960 * scale,
          height: 540 * scale,
          borderRadius: 8 * scale,
          boxShadow: isActive
            ? `0 0 0 2px var(--accent-blue)`
            : `0 ${1 * scale}px ${4 * scale}px rgba(0,0,0,0.08), 0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.04)`,
          transition: "box-shadow 0.15s",
        }}
      >
        <ShadowSlide
          html={sanitizeSlideHtml(enforceSlideContrast(slide.html))}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: 960,
            height: 540,
          }}
        />
      </div>
    );
  }

  const hasBackgroundImage = !!slide.backgroundImage;

  // Override text colors to white when background image is present
  const effectiveTheme = useMemo(() => {
    if (!hasBackgroundImage) return t;
    return {
      ...t,
      text: "#ffffff",
      textSecondary: "rgba(255,255,255,0.75)",
      cardBg: "rgba(255,255,255,0.1)",
      cardBorder: "rgba(255,255,255,0.15)",
    };
  }, [t, hasBackgroundImage]);

  const isCentered = slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" || slide.layout === "imageFeature" || slide.layout === "statement";

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden select-none ${onClick ? "cursor-pointer" : ""}`}
      style={{
        width: 960 * scale,
        height: 540 * scale,
        background: hasBackgroundImage
          ? `url(${slide.backgroundImage}) center/cover no-repeat`
          : t.bg,
        color: effectiveTheme.text,
        fontFamily: t.bodyFont,
        borderRadius: 8 * scale,
        boxShadow: isActive
          ? `0 0 0 2px var(--accent-blue)`
          : `0 ${1 * scale}px ${4 * scale}px rgba(0,0,0,0.08), 0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.04)`,
        transition: "box-shadow 0.15s",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: 960,
          height: 540,
          position: "relative",
        }}
      >
        {/* Overlay when background image present — always apply gradient scrim */}
        {hasBackgroundImage && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background: slide.backgroundOverlay || "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))",
            }}
          />
        )}

        {/* Decorative layer — hidden when background image is present */}
        {!hasBackgroundImage && <DecorLayer t={t} />}

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: isCentered ? "center" : "flex-start",
            padding: `${PAD.v}px ${PAD.h}px`,
            boxSizing: "border-box",
          }}
        >
          {renderLayout(slide, effectiveTheme, edit)}
        </div>
      </div>
    </div>
  );
}

/* ━━ Decorative background layer (3 refined styles) ━━ */

function DecorLayer({ t }: { t: ThemeConfig }) {
  switch (t.decorStyle) {
    case "geometric":
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 100,
              height: 100,
              border: `1.5px solid ${t.accentLight}`,
              borderRadius: 12,
              transform: "rotate(45deg)",
              opacity: 0.8,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 50,
              left: -15,
              width: 44,
              height: 44,
              backgroundColor: t.accentLight,
              borderRadius: 6,
              transform: "rotate(15deg)",
              opacity: 0.6,
            }}
          />
        </>
      );

    case "minimal":
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: PAD.v,
              left: 0,
              width: 3,
              height: 64,
              backgroundColor: t.accent,
              borderRadius: "0 2px 2px 0",
              opacity: 0.7,
            }}
          />
        </>
      );

    case "gradient":
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: -180,
              right: -120,
              width: 500,
              height: 500,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 60%)`,
              borderRadius: "50%",
              opacity: 0.8,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -160,
              left: -100,
              width: 400,
              height: 400,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 60%)`,
              borderRadius: "50%",
              opacity: 0.5,
            }}
          />
        </>
      );
  }
}

/* ━━ Shared editable components ━━ */

function EditableHeading({
  value,
  placeholder,
  onChange,
  style,
}: {
  value: string;
  placeholder: string;
  onChange?: (v: string) => void;
  style: React.CSSProperties;
}) {
  if (!onChange) return <div style={style}>{value || placeholder}</div>;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...style,
        background: "transparent",
        border: "none",
        outline: "none",
        width: "100%",
        padding: 0,
        margin: 0,
      }}
    />
  );
}

function EditableText({
  value,
  placeholder,
  onChange,
  style,
}: {
  value: string;
  placeholder: string;
  onChange?: (v: string) => void;
  style: React.CSSProperties;
}) {
  if (!onChange) return <div style={style}>{value || placeholder}</div>;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...style,
        background: "transparent",
        border: "none",
        outline: "none",
        width: "100%",
        padding: 0,
        margin: 0,
        resize: "none",
        overflow: "hidden",
      }}
    />
  );
}

/* ━━ Layout router ━━ */

function renderLayout(slide: DeckSlide, t: ThemeConfig, edit?: SlideEditHandlers) {
  switch (slide.layout) {
    case "title":
      return <TitleLayout slide={slide} t={t} edit={edit} />;
    case "section":
      return <SectionLayout slide={slide} t={t} edit={edit} />;
    case "bullets":
      return <BulletsLayout slide={slide} t={t} edit={edit} />;
    case "titleContent":
      return <TitleContentLayout slide={slide} t={t} edit={edit} />;
    case "twoColumn":
      return <TwoColumnLayout slide={slide} t={t} edit={edit} />;
    case "quote":
      return <QuoteLayout slide={slide} t={t} edit={edit} />;
    case "stats":
      return <StatsLayout slide={slide} t={t} edit={edit} />;
    case "imageFeature":
      return <ImageFeatureLayout slide={slide} t={t} edit={edit} />;
    case "statement":
      return <StatementLayout slide={slide} t={t} edit={edit} />;
    case "metrics":
      return <MetricsLayout slide={slide} t={t} edit={edit} />;
    case "featureGrid":
      return <FeatureGridLayout slide={slide} t={t} edit={edit} />;
    case "logoGrid":
      return <LogoGridLayout slide={slide} t={t} edit={edit} />;
    case "blank":
    default:
      return <BlankLayout slide={slide} t={t} edit={edit} />;
  }
}

/* ━━ Title Slide ━━ */
function TitleLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const hasImage = !!slide.backgroundImage;
  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.display.size,
    fontWeight: t.headingWeight,
    lineHeight: TYPE.display.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.display.spacing,
    color: t.text,
    textAlign: "center",
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
    textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.4)" : undefined,
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: TYPE.subheading.size,
    color: t.textSecondary,
    lineHeight: TYPE.subheading.lineHeight,
    fontWeight: TYPE.subheading.weight,
    letterSpacing: TYPE.subheading.spacing,
    textAlign: "center",
    marginTop: 20,
    fontFamily: t.bodyFont,
    textShadow: hasImage ? "0 1px 8px rgba(0,0,0,0.3)" : undefined,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 800, margin: "0 auto", width: "100%" }}>
      {!hasImage && (
        <div
          style={{
            width: 48,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            margin: "0 auto 28px",
          }}
        />
      )}
      <EditableHeading value={slide.title || ""} placeholder="Untitled" onChange={edit?.onTitleChange} style={headingStyle} />
      {(slide.subtitle || edit) && (
        <EditableHeading
          value={slide.subtitle || ""}
          placeholder={edit ? "Add subtitle..." : ""}
          onChange={edit?.onSubtitleChange}
          style={subtitleStyle}
        />
      )}
    </div>
  );
}

/* ━━ Image Feature (Hero) ━━ */
function ImageFeatureLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.display.size + 8,
    fontWeight: t.headingWeight,
    lineHeight: TYPE.display.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.display.spacing,
    color: "#ffffff",
    textAlign: "center",
    textShadow: "0 3px 16px rgba(0,0,0,0.5)",
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: TYPE.subheading.size,
    color: "rgba(255,255,255,0.75)",
    lineHeight: TYPE.subheading.lineHeight,
    fontWeight: 400,
    textAlign: "center",
    marginTop: 20,
    fontFamily: t.bodyFont,
    textShadow: "0 1px 8px rgba(0,0,0,0.3)",
  };
  const contentStyle: React.CSSProperties = {
    fontSize: TYPE.body.size,
    color: "rgba(255,255,255,0.65)",
    lineHeight: TYPE.body.lineHeight,
    textAlign: "center",
    fontFamily: t.bodyFont,
    position: "absolute",
    bottom: PAD.v,
    left: PAD.h,
    right: PAD.h,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 820, margin: "0 auto", width: "100%" }}>
      <EditableHeading value={slide.title || ""} placeholder="Hero Title" onChange={edit?.onTitleChange} style={headingStyle} />
      {(slide.subtitle || edit) && (
        <EditableHeading
          value={slide.subtitle || ""}
          placeholder={edit ? "Add subtitle..." : ""}
          onChange={edit?.onSubtitleChange}
          style={subtitleStyle}
        />
      )}
      {slide.content && !edit && (
        <div style={contentStyle}>{slide.content}</div>
      )}
      {edit && (
        <EditableText
          value={slide.content || ""}
          placeholder="Add bottom text..."
          onChange={edit.onContentChange}
          style={{ ...contentStyle, position: "relative", bottom: "auto", left: "auto", right: "auto", marginTop: GAP.element }}
        />
      )}
    </div>
  );
}

/* ━━ Section Break ━━ */
function SectionLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 44,
    fontWeight: t.headingWeight,
    lineHeight: 1.2,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textAlign: "center",
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 40, height: 1, backgroundColor: t.divider }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${t.accent}` }} />
        <div style={{ width: 40, height: 1, backgroundColor: t.divider }} />
      </div>
      <EditableHeading value={slide.title || ""} placeholder="Section" onChange={edit?.onTitleChange} style={headingStyle} />
    </div>
  );
}

/* ━━ Statement — Big Idea Slide ━━ */
function StatementLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const statementStyle: React.CSSProperties = {
    fontSize: 42,
    fontWeight: 600,
    lineHeight: 1.25,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textAlign: "center",
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const attributionStyle: React.CSSProperties = {
    fontSize: TYPE.label.size,
    color: t.textSecondary,
    fontWeight: TYPE.label.weight,
    letterSpacing: TYPE.label.spacing,
    textTransform: "uppercase",
    textAlign: "center",
    fontFamily: t.bodyFont,
    marginTop: GAP.section,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <EditableText
        value={slide.content || ""}
        placeholder={edit ? "Enter your big idea..." : "Statement"}
        onChange={edit?.onContentChange}
        style={statementStyle}
      />
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Source or attribution..." : ""}
          onChange={edit?.onTitleChange}
          style={attributionStyle}
        />
      )}
    </div>
  );
}

/* ━━ Bullet icon renderer ━━ */
function BulletIcon({ index, t }: { index: number; t: ThemeConfig }) {
  switch (t.bulletStyle) {
    case "number":
      return (
        <span
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: t.accentLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: t.accent,
            fontFamily: t.bodyFont,
            marginTop: 2,
          }}
        >
          {index + 1}
        </span>
      );
    case "dash":
      return <span style={{ flexShrink: 0, fontSize: 20, fontWeight: 700, color: t.accent, lineHeight: 1, marginTop: 4 }}>—</span>;
    case "arrow":
      return <span style={{ flexShrink: 0, fontSize: 22, fontWeight: 700, color: t.accent, marginTop: 1 }}>›</span>;
    case "check":
      return (
        <span
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 6,
            backgroundColor: t.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "#fff",
            fontWeight: 700,
            marginTop: 3,
          }}
        >
          ✓
        </span>
      );
    case "ring":
      return (
        <span
          style={{
            flexShrink: 0,
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: `2.5px solid ${t.accent}`,
            marginTop: 8,
          }}
        />
      );
    case "bar":
      return (
        <span
          style={{
            flexShrink: 0,
            width: 3,
            height: 20,
            borderRadius: 2,
            backgroundColor: t.accent,
            marginTop: 5,
          }}
        />
      );
    case "disc":
    default:
      return (
        <span
          style={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: t.accent,
            marginTop: 10,
          }}
        />
      );
  }
}

/* ━━ Bullets ━━ */
function BulletsLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const bullets = slide.bullets || [];

  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: GAP.section,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  return (
    <>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", flex: 1 }}>
        {bullets.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "10px 16px",
              borderLeft: `3px solid ${t.accent}`,
              borderRadius: 2,
            }}
          >
            <BulletIcon index={i} t={t} />
            {edit ? (
              <input
                value={b}
                onChange={(e) => {
                  const updated = [...bullets];
                  updated[i] = e.target.value;
                  edit.onBulletsChange(updated);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const updated = [...bullets];
                    updated.splice(i + 1, 0, "");
                    edit.onBulletsChange(updated);
                  }
                  if (e.key === "Backspace" && b === "" && bullets.length > 1) {
                    e.preventDefault();
                    edit.onBulletsChange(bullets.filter((_, j) => j !== i));
                  }
                }}
                placeholder="Add point..."
                style={{
                  fontSize: TYPE.body.size,
                  lineHeight: TYPE.body.lineHeight,
                  flex: 1,
                  color: t.text,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: 0,
                  margin: 0,
                  fontFamily: t.bodyFont,
                }}
              />
            ) : (
              <span style={{ fontSize: TYPE.body.size, lineHeight: TYPE.body.lineHeight, flex: 1, fontFamily: t.bodyFont }}>{b}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ━━ Title + Content ━━ */
function TitleContentLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: 12,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: TYPE.body.size,
    lineHeight: TYPE.body.lineHeight,
    color: t.textSecondary,
    whiteSpace: "pre-wrap",
    maxWidth: 780,
    fontFamily: t.bodyFont,
    flex: 1,
  };

  return (
    <>
      {(slide.title || edit) && (
        <>
          <EditableHeading
            value={slide.title || ""}
            placeholder={edit ? "Add title..." : ""}
            onChange={edit?.onTitleChange}
            style={headingStyle}
          />
          <div
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              marginBottom: GAP.section,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            }}
          />
        </>
      )}
      <EditableText
        value={slide.content || ""}
        placeholder={edit ? "Add content..." : ""}
        onChange={edit?.onContentChange}
        style={contentStyle}
      />
    </>
  );
}

/* ━━ Two Column ━━ */
function TwoColumnLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: 12,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const colStyle: React.CSSProperties = {
    fontSize: 17,
    lineHeight: TYPE.body.lineHeight,
    color: t.textSecondary,
    whiteSpace: "pre-wrap",
    fontFamily: t.bodyFont,
    flex: 1,
  };

  return (
    <>
      {(slide.title || edit) && (
        <>
          <EditableHeading
            value={slide.title || ""}
            placeholder={edit ? "Add title..." : ""}
            onChange={edit?.onTitleChange}
            style={headingStyle}
          />
          <div
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              marginBottom: GAP.section,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            }}
          />
        </>
      )}
      <div style={{ display: "flex", gap: 28, flex: 1 }}>
        <div
          style={{
            flex: 1,
            padding: "20px 24px",
            borderRadius: 12,
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <EditableText
            value={slide.content || ""}
            placeholder={edit ? "Left column..." : "Left column"}
            onChange={edit?.onContentChange}
            style={colStyle}
          />
        </div>
        <div
          style={{
            flex: 1,
            padding: "20px 24px",
            borderRadius: 12,
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          <EditableText
            value={slide.subtitle || ""}
            placeholder={edit ? "Right column..." : "Right column"}
            onChange={edit?.onSubtitleChange}
            style={colStyle}
          />
        </div>
      </div>
    </>
  );
}

/* ━━ Quote ━━ */
function QuoteLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const quoteStyle: React.CSSProperties = {
    fontSize: 30,
    fontStyle: "italic",
    lineHeight: 1.5,
    fontWeight: 400,
    letterSpacing: "0.005em",
    color: t.text,
    fontFamily: t.headingFont,
    textAlign: "center",
  };
  const attrStyle: React.CSSProperties = {
    fontSize: 16,
    color: t.textSecondary,
    fontStyle: "normal",
    fontWeight: 500,
    letterSpacing: "0.03em",
    textAlign: "center",
    fontFamily: t.bodyFont,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", width: "100%", padding: "0 16px" }}>
      <div
        style={{
          fontSize: 120,
          lineHeight: 0.6,
          fontFamily: t.headingFont,
          color: t.accent,
          opacity: 0.25,
          marginBottom: 12,
          fontWeight: t.headingWeight,
        }}
      >
        &ldquo;
      </div>
      <EditableText
        value={slide.content || ""}
        placeholder={edit ? "Enter quote..." : "Quote text"}
        onChange={edit?.onContentChange}
        style={quoteStyle}
      />
      {(slide.title || edit) && (
        <div style={{ marginTop: GAP.section, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 24, height: 2, backgroundColor: t.accent, borderRadius: 1 }} />
          <EditableHeading
            value={slide.title || ""}
            placeholder={edit ? "Attribution..." : ""}
            onChange={edit?.onTitleChange}
            style={{ ...attrStyle, width: "auto", maxWidth: 400 }}
          />
          <div style={{ width: 24, height: 2, backgroundColor: t.accent, borderRadius: 1 }} />
        </div>
      )}
    </div>
  );
}

/* ━━ Stats (legacy — kept for backward compat) ━━ */
function StatsLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const stats = slide.stats || [];

  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: 36,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  return (
    <>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      <div
        style={{
          display: "flex",
          gap: 20,
          flex: 1,
          alignItems: "stretch",
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "28px 20px",
              borderRadius: 14,
              backgroundColor: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              textAlign: "center",
              gap: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})` }} />
            {edit?.onStatsChange ? (
              <>
                <input
                  value={stat.value}
                  onChange={(e) => {
                    const updated = [...stats];
                    updated[i] = { ...stat, value: e.target.value };
                    edit.onStatsChange!(updated);
                  }}
                  placeholder="0"
                  style={{
                    fontSize: 52,
                    fontWeight: t.headingWeight,
                    fontFamily: t.headingFont,
                    color: t.accent,
                    letterSpacing: TYPE.bigNumber.spacing,
                    lineHeight: 1.1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    width: "100%",
                    textAlign: "center",
                    padding: 0,
                  }}
                />
                <input
                  value={stat.label}
                  onChange={(e) => {
                    const updated = [...stats];
                    updated[i] = { ...stat, label: e.target.value };
                    edit.onStatsChange!(updated);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const updated = [...stats];
                      updated.splice(i + 1, 0, { value: "0", label: "Label" });
                      edit.onStatsChange!(updated);
                    }
                    if (e.key === "Backspace" && stat.label === "" && stat.value === "" && stats.length > 1) {
                      e.preventDefault();
                      edit.onStatsChange!(stats.filter((_, j) => j !== i));
                    }
                  }}
                  placeholder="Label"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: t.bodyFont,
                    color: t.textSecondary,
                    letterSpacing: TYPE.label.spacing,
                    textTransform: "uppercase",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    width: "100%",
                    textAlign: "center",
                    padding: 0,
                  }}
                />
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 52,
                    fontWeight: t.headingWeight,
                    fontFamily: t.headingFont,
                    color: t.accent,
                    letterSpacing: TYPE.bigNumber.spacing,
                    lineHeight: 1.1,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: t.bodyFont,
                    color: t.textSecondary,
                    letterSpacing: TYPE.label.spacing,
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </div>
              </>
            )}
          </div>
        ))}
        {stats.length === 0 && (
          edit?.onStatsChange ? (
            <div
              onClick={() => edit.onStatsChange!([{ value: "0", label: "Metric" }])}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.textSecondary,
                fontSize: 16,
                cursor: "pointer",
                border: `1px dashed ${t.cardBorder}`,
                borderRadius: 14,
              }}
            >
              Click to add a metric
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textSecondary, fontSize: 16 }}>
              No metrics defined
            </div>
          )
        )}
      </div>
    </>
  );
}

/* ━━ Metrics — Premium metric highlight (replaces stats for new decks) ━━ */
function MetricsLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const stats = slide.stats || [];

  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: 40,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  return (
    <>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {stats.map((stat, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {/* Metric */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 48px",
                textAlign: "center",
              }}
            >
              {edit?.onStatsChange ? (
                <>
                  <input
                    value={stat.value}
                    onChange={(e) => {
                      const updated = [...stats];
                      updated[i] = { ...stat, value: e.target.value };
                      edit.onStatsChange!(updated);
                    }}
                    placeholder="0"
                    style={{
                      fontSize: TYPE.bigNumber.size,
                      fontWeight: TYPE.bigNumber.weight,
                      fontFamily: t.headingFont,
                      color: t.accent,
                      letterSpacing: TYPE.bigNumber.spacing,
                      lineHeight: TYPE.bigNumber.lineHeight,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      width: "100%",
                      textAlign: "center",
                      padding: 0,
                    }}
                  />
                  <input
                    value={stat.label}
                    onChange={(e) => {
                      const updated = [...stats];
                      updated[i] = { ...stat, label: e.target.value };
                      edit.onStatsChange!(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const updated = [...stats];
                        updated.splice(i + 1, 0, { value: "0", label: "Label" });
                        edit.onStatsChange!(updated);
                      }
                      if (e.key === "Backspace" && stat.label === "" && stat.value === "" && stats.length > 1) {
                        e.preventDefault();
                        edit.onStatsChange!(stats.filter((_, j) => j !== i));
                      }
                    }}
                    placeholder="Label"
                    style={{
                      fontSize: TYPE.label.size,
                      fontWeight: TYPE.label.weight,
                      fontFamily: t.bodyFont,
                      color: t.textSecondary,
                      letterSpacing: TYPE.label.spacing,
                      textTransform: "uppercase",
                      marginTop: 12,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      width: "100%",
                      textAlign: "center",
                      padding: 0,
                    }}
                  />
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: TYPE.bigNumber.size,
                      fontWeight: TYPE.bigNumber.weight,
                      fontFamily: t.headingFont,
                      color: t.accent,
                      letterSpacing: TYPE.bigNumber.spacing,
                      lineHeight: TYPE.bigNumber.lineHeight,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: TYPE.label.size,
                      fontWeight: TYPE.label.weight,
                      fontFamily: t.bodyFont,
                      color: t.textSecondary,
                      letterSpacing: TYPE.label.spacing,
                      textTransform: "uppercase",
                      marginTop: 12,
                    }}
                  >
                    {stat.label}
                  </div>
                </>
              )}
            </div>
            {/* Divider between metrics */}
            {i < stats.length - 1 && (
              <div style={{ width: 1, height: 64, backgroundColor: t.divider, flexShrink: 0 }} />
            )}
          </div>
        ))}
        {stats.length === 0 && (
          edit?.onStatsChange ? (
            <div
              onClick={() => edit.onStatsChange!([{ value: "0", label: "Metric" }])}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.textSecondary,
                fontSize: 16,
                cursor: "pointer",
                border: `1px dashed ${t.cardBorder}`,
                borderRadius: 14,
                padding: "40px 60px",
              }}
            >
              Click to add a metric
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: t.textSecondary, fontSize: 16 }}>
              No metrics defined
            </div>
          )
        )}
      </div>
    </>
  );
}

/* ━━ Feature Grid — Icon feature cards ━━ */
function FeatureGridLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const bullets = slide.bullets || [];

  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: GAP.section,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  // Parse bullets: "**Title** Description" → { title, desc }
  const features = bullets.map((b) => {
    const match = b.match(/^\*\*(.+?)\*\*\s*(.*)/);
    if (match) return { title: match[1], desc: match[2] };
    return { title: b, desc: "" };
  });

  const cols = features.length <= 4 ? 2 : 3;

  return (
    <>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      {edit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", flex: 1 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BulletIcon index={i} t={t} />
              <input
                value={b}
                onChange={(e) => {
                  const updated = [...bullets];
                  updated[i] = e.target.value;
                  edit.onBulletsChange(updated);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const updated = [...bullets];
                    updated.splice(i + 1, 0, "");
                    edit.onBulletsChange(updated);
                  }
                  if (e.key === "Backspace" && b === "" && bullets.length > 1) {
                    e.preventDefault();
                    edit.onBulletsChange(bullets.filter((_, j) => j !== i));
                  }
                }}
                placeholder="**Feature Title** Description text..."
                style={{
                  fontSize: TYPE.body.size - 2,
                  flex: 1,
                  color: t.text,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "6px 0",
                  fontFamily: t.bodyFont,
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            flex: 1,
            alignContent: "start",
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: "20px 22px",
                borderRadius: 12,
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.text,
                  fontFamily: t.bodyFont,
                  marginBottom: 6,
                }}
              >
                {f.title}
              </div>
              {f.desc && (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: t.textSecondary,
                    fontFamily: t.bodyFont,
                  }}
                >
                  {f.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ━━ Logo Grid — Partner/customer logos ━━ */
function LogoGridLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const bullets = slide.bullets || [];

  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: 40,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textAlign: "center",
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };

  const cols = bullets.length <= 4 ? bullets.length : bullets.length <= 6 ? 3 : 4;

  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      {edit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {bullets.map((b, i) => (
            <input
              key={i}
              value={b}
              onChange={(e) => {
                const updated = [...bullets];
                updated[i] = e.target.value;
                edit.onBulletsChange(updated);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const updated = [...bullets];
                  updated.splice(i + 1, 0, "");
                  edit.onBulletsChange(updated);
                }
                if (e.key === "Backspace" && b === "" && bullets.length > 1) {
                  e.preventDefault();
                  edit.onBulletsChange(bullets.filter((_, j) => j !== i));
                }
              }}
              placeholder="Company name..."
              style={{
                fontSize: TYPE.body.size,
                color: t.text,
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "4px 0",
                fontFamily: t.bodyFont,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 20,
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          {bullets.map((name, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 20px",
                borderRadius: 12,
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: t.textSecondary,
                  fontFamily: t.bodyFont,
                  letterSpacing: "0.02em",
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ━━ Blank / Default ━━ */
function BlankLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: TYPE.heading.size,
    fontWeight: t.headingWeight,
    marginBottom: GAP.element,
    lineHeight: TYPE.heading.lineHeight,
    fontFamily: t.headingFont,
    letterSpacing: TYPE.heading.spacing,
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: TYPE.body.size,
    lineHeight: TYPE.body.lineHeight,
    color: t.textSecondary,
    whiteSpace: "pre-wrap",
    fontFamily: t.bodyFont,
    flex: 1,
  };

  return (
    <>
      {(slide.title || edit) && (
        <EditableHeading
          value={slide.title || ""}
          placeholder={edit ? "Add title..." : ""}
          onChange={edit?.onTitleChange}
          style={headingStyle}
        />
      )}
      <EditableText
        value={slide.content || ""}
        placeholder={edit ? "Add content..." : ""}
        onChange={edit?.onContentChange}
        style={contentStyle}
      />
    </>
  );
}
