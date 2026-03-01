"use client";

import { useEffect, useMemo } from "react";
import { DeckSlide } from "@/lib/types";
import { ThemeConfig, getThemeConfig, loadThemeFonts } from "./deckThemes";

export interface SlideEditHandlers {
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onBulletsChange: (bullets: string[]) => void;
  onStatsChange?: (stats: { value: string; label: string }[]) => void;
}

interface SlideRendererProps {
  slide: DeckSlide;
  theme: string;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
  edit?: SlideEditHandlers;
}

export function SlideRenderer({ slide, theme, scale = 1, onClick, isActive, edit }: SlideRendererProps) {
  const t = getThemeConfig(theme);

  useEffect(() => {
    loadThemeFonts(theme);
  }, [theme]);

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

  const isCentered = slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" || slide.layout === "imageFeature";

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
          ? `0 0 0 2px #3B82F6`
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
        {/* Overlay when background image present */}
        {hasBackgroundImage && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background: slide.backgroundOverlay || "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.7))",
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
            padding: isCentered ? "64px 80px" : "56px 72px",
            boxSizing: "border-box",
          }}
        >
          {renderLayout(slide, effectiveTheme, edit)}
        </div>
      </div>
    </div>
  );
}

/* ━━ Decorative background layer ━━ */

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
              width: 120,
              height: 120,
              border: `2px solid ${t.accentLight}`,
              borderRadius: 16,
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: -20,
              width: 60,
              height: 60,
              backgroundColor: t.accentLight,
              borderRadius: 8,
              transform: "rotate(15deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            }}
          />
        </>
      );

    case "organic":
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: -120,
              right: -80,
              width: 400,
              height: 400,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 70%)`,
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -100,
              left: -60,
              width: 300,
              height: 300,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 70%)`,
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent 0%, ${t.accent} 50%, transparent 100%)`,
              opacity: 0.4,
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
              top: 48,
              left: 0,
              width: 4,
              height: 80,
              backgroundColor: t.accent,
              borderRadius: "0 2px 2px 0",
              opacity: 0.8,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 72,
              right: 72,
              height: 1,
              backgroundColor: t.divider,
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
              top: -150,
              right: -100,
              width: 500,
              height: 500,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 60%)`,
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -120,
              left: -80,
              width: 400,
              height: 400,
              background: `radial-gradient(circle, rgba(255,60,172,0.08) 0%, transparent 60%)`,
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: 0,
              right: 0,
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            }}
          />
        </>
      );

    case "dots":
      return (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.04,
              backgroundImage: `radial-gradient(${t.accent} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 300,
              height: 300,
              background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 60%)`,
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            }}
          />
        </>
      );

    case "lines":
      return (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 200,
              height: 200,
              opacity: 0.03,
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                ${t.accent},
                ${t.accent} 1px,
                transparent 1px,
                transparent 16px
              )`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 48,
              height: 48,
              border: `1.5px solid ${t.accentLight}`,
              borderRadius: 8,
              transform: "rotate(45deg)",
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
    case "blank":
    default:
      return <BlankLayout slide={slide} t={t} edit={edit} />;
  }
}

/* ━━ Title Slide ━━ */
function TitleLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const hasImage = !!slide.backgroundImage;
  const headingStyle: React.CSSProperties = {
    fontSize: 56,
    fontWeight: t.headingWeight,
    lineHeight: 1.05,
    fontFamily: t.headingFont,
    letterSpacing: "-0.04em",
    color: t.text,
    textAlign: "center",
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
    textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.4)" : undefined,
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: 21,
    color: t.textSecondary,
    lineHeight: 1.55,
    fontWeight: 400,
    letterSpacing: "0.01em",
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
            height: 4,
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
    fontSize: 64,
    fontWeight: t.headingWeight,
    lineHeight: 1.05,
    fontFamily: t.headingFont,
    letterSpacing: "-0.04em",
    color: "#ffffff",
    textAlign: "center",
    textShadow: "0 3px 16px rgba(0,0,0,0.5)",
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: 22,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 1.5,
    fontWeight: 400,
    textAlign: "center",
    marginTop: 20,
    fontFamily: t.bodyFont,
    textShadow: "0 1px 8px rgba(0,0,0,0.3)",
  };
  const contentStyle: React.CSSProperties = {
    fontSize: 18,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.6,
    textAlign: "center",
    fontFamily: t.bodyFont,
    position: "absolute",
    bottom: 56,
    left: 80,
    right: 80,
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
          style={{ ...contentStyle, position: "relative", bottom: "auto", left: "auto", right: "auto", marginTop: 24 }}
        />
      )}
      {/* Decorative bottom gradient bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
        }}
      />
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
    letterSpacing: "-0.02em",
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
            width: 4,
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
    fontSize: 38,
    fontWeight: t.headingWeight,
    marginBottom: 32,
    lineHeight: 1.15,
    fontFamily: t.headingFont,
    letterSpacing: "-0.03em",
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
                  fontSize: 18,
                  lineHeight: 1.65,
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
              <span style={{ fontSize: 18, lineHeight: 1.65, flex: 1, fontFamily: t.bodyFont }}>{b}</span>
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
    fontSize: 38,
    fontWeight: t.headingWeight,
    marginBottom: 12,
    lineHeight: 1.15,
    fontFamily: t.headingFont,
    letterSpacing: "-0.03em",
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: 18,
    lineHeight: 1.65,
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
              marginBottom: 28,
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
    fontSize: 38,
    fontWeight: t.headingWeight,
    marginBottom: 12,
    lineHeight: 1.15,
    fontFamily: t.headingFont,
    letterSpacing: "-0.03em",
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const colStyle: React.CSSProperties = {
    fontSize: 17,
    lineHeight: 1.65,
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
              marginBottom: 32,
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
        <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
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

/* ━━ Stats / Metrics ━━ */
function StatsLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const stats = slide.stats || [];

  const headingStyle: React.CSSProperties = {
    fontSize: 38,
    fontWeight: t.headingWeight,
    marginBottom: 36,
    lineHeight: 1.15,
    fontFamily: t.headingFont,
    letterSpacing: "-0.03em",
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
                    letterSpacing: "-0.03em",
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
                    letterSpacing: "0.04em",
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
                    letterSpacing: "-0.03em",
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
                    letterSpacing: "0.04em",
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

/* ━━ Blank / Default ━━ */
function BlankLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 38,
    fontWeight: t.headingWeight,
    marginBottom: 24,
    lineHeight: 1.15,
    fontFamily: t.headingFont,
    letterSpacing: "-0.03em",
    color: t.text,
    textTransform: t.headingCase === "uppercase" ? "uppercase" : undefined,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: 18,
    lineHeight: 1.65,
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
