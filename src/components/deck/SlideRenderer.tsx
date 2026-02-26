"use client";

import { DeckSlide, DeckTheme } from "@/lib/types";
import { deckThemes, ThemeConfig } from "./deckThemes";

/** Callbacks for inline editing — when provided, inputs render in place of static text */
export interface SlideEditHandlers {
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onBulletsChange: (bullets: string[]) => void;
}

interface SlideRendererProps {
  slide: DeckSlide;
  theme: DeckTheme;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
  edit?: SlideEditHandlers;
}

export function SlideRenderer({ slide, theme, scale = 1, onClick, isActive, edit }: SlideRendererProps) {
  const t = deckThemes[theme];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden select-none ${onClick ? "cursor-pointer" : ""}`}
      style={{
        width: 960 * scale,
        height: 540 * scale,
        background: t.bg,
        color: t.text,
        fontFamily: t.font,
        borderRadius: 8 * scale,
        boxShadow: isActive
          ? `0 0 0 ${2 / scale}px #3B82F6`
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
        <DecorLayer theme={theme} layout={slide.layout} t={t} />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" ? "center" : "flex-start",
            padding: slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" ? "64px 80px" : "56px 72px",
            boxSizing: "border-box",
          }}
        >
          {renderLayout(slide, t, theme, edit)}
        </div>
      </div>
    </div>
  );
}

/* ── Decorative background layer ── */

function DecorLayer({ theme, layout, t }: { theme: DeckTheme; layout: string; t: ThemeConfig }) {
  const isCentered = layout === "title" || layout === "section" || layout === "quote";

  if (theme === "dark") {
    return (
      <>
        <div style={{
          position: "absolute", top: -100, right: -100, width: 500, height: 500,
          background: `radial-gradient(circle, ${t.decorShape} 0%, transparent 70%)`,
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: -80, width: 400, height: 400,
          background: "radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
        }} />
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `radial-gradient(${t.text} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }} />
      </>
    );
  }

  if (theme === "gradient") {
    return (
      <>
        <div style={{
          position: "absolute", top: -200, right: -150, width: 600, height: 600,
          background: "rgba(255,255,255,0.03)",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.06)",
        }} />
        <div style={{
          position: "absolute", bottom: -100, left: -100, width: 350, height: 350,
          background: "rgba(255,255,255,0.02)",
          borderRadius: "50%",
        }} />
        {isCentered && (
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            transform: "translateY(-120px)",
          }} />
        )}
      </>
    );
  }

  if (theme === "minimal") {
    return (
      <div style={{
        position: "absolute", top: 40, left: 0, width: 4, height: isCentered ? 100 : 460,
        backgroundColor: t.accent,
        borderRadius: "0 2px 2px 0",
      }} />
    );
  }

  if (theme === "corporate") {
    return (
      <>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 5,
          background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
          backgroundColor: t.decorBg,
          borderTop: `1px solid ${t.cardBorder}`,
        }} />
        <div style={{
          position: "absolute", top: 24, right: 24, width: 60, height: 60,
          border: `2px solid ${t.decorShape.replace("0.05", "0.12")}`,
          borderRadius: 12,
          transform: "rotate(45deg)",
        }} />
      </>
    );
  }

  // Light
  return (
    <>
      <div style={{
        position: "absolute", top: -180, right: -180, width: 400, height: 400,
        background: t.decorShape,
        borderRadius: "50%",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
      }} />
    </>
  );
}

/* ── Shared editable text components ── */

function EditableHeading({ value, placeholder, onChange, style }: {
  value: string; placeholder: string;
  onChange?: (v: string) => void;
  style: React.CSSProperties;
}) {
  if (!onChange) {
    return <div style={style}>{value || placeholder}</div>;
  }
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

function EditableText({ value, placeholder, onChange, style }: {
  value: string; placeholder: string;
  onChange?: (v: string) => void;
  style: React.CSSProperties;
}) {
  if (!onChange) {
    return <div style={style}>{value || placeholder}</div>;
  }
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

/* ── Layout renderers ── */

function renderLayout(slide: DeckSlide, t: ThemeConfig, theme: DeckTheme, edit?: SlideEditHandlers) {
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
    case "blank":
    default:
      return <BlankLayout slide={slide} t={t} edit={edit} />;
  }
}

/* ── Title Slide ── */
function TitleLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 52, fontWeight: 800, lineHeight: 1.15,
    fontFamily: t.headingFont, letterSpacing: "-0.025em",
    color: t.text, textAlign: "center" as const,
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: 22, color: t.subtitle, lineHeight: 1.5,
    fontWeight: 400, letterSpacing: "0.01em",
    textAlign: "center" as const, marginTop: 20,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <div style={{
        width: 48, height: 4, borderRadius: 2,
        background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
        margin: "0 auto 28px",
      }} />
      <EditableHeading
        value={slide.title || ""}
        placeholder="Untitled"
        onChange={edit?.onTitleChange}
        style={headingStyle}
      />
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

/* ── Section Break ── */
function SectionLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 44, fontWeight: 700, lineHeight: 1.2,
    fontFamily: t.headingFont, letterSpacing: "-0.02em",
    color: t.text, textAlign: "center" as const,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 40, height: 1, backgroundColor: t.divider }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${t.accent}` }} />
        <div style={{ width: 40, height: 1, backgroundColor: t.divider }} />
      </div>
      <EditableHeading
        value={slide.title || ""}
        placeholder="Section"
        onChange={edit?.onTitleChange}
        style={headingStyle}
      />
    </div>
  );
}

/* ── Bullets ── */
function BulletsLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const bullets = slide.bullets || [];

  const headingStyle: React.CSSProperties = {
    fontSize: 34, fontWeight: 700, marginBottom: 32, lineHeight: 1.2,
    fontFamily: t.headingFont, letterSpacing: "-0.02em", color: t.text,
  };

  const renderBulletIcon = (index: number) => {
    const s = t.bulletStyle;
    if (s === "number") {
      return (
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
          backgroundColor: t.decorShape, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: t.accent,
          fontFamily: t.font, marginTop: 2,
        }}>
          {index + 1}
        </span>
      );
    }
    if (s === "dash") {
      return <span style={{ flexShrink: 0, fontSize: 20, fontWeight: 700, color: t.accent, lineHeight: 1, marginTop: 4 }}>—</span>;
    }
    if (s === "arrow") {
      return <span style={{ flexShrink: 0, fontSize: 22, fontWeight: 700, color: t.accent, marginTop: 1 }}>›</span>;
    }
    if (s === "check") {
      return (
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6,
          backgroundColor: t.accent, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 13, color: "#fff", fontWeight: 700, marginTop: 3,
        }}>
          ✓
        </span>
      );
    }
    // disc
    return (
      <span style={{
        flexShrink: 0, width: 8, height: 8, borderRadius: "50%",
        backgroundColor: t.accent, marginTop: 10, display: "block",
      }} />
    );
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", flex: 1 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            padding: "10px 16px",
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 10,
          }}>
            {renderBulletIcon(i)}
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
                  fontSize: 20, lineHeight: 1.5, flex: 1, color: t.text,
                  background: "transparent", border: "none", outline: "none",
                  padding: 0, margin: 0, fontFamily: t.font,
                }}
              />
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1.5, flex: 1 }}>{b}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Title + Content ── */
function TitleContentLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 34, fontWeight: 700, marginBottom: 12, lineHeight: 1.2,
    fontFamily: t.headingFont, letterSpacing: "-0.02em", color: t.text,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: 20, lineHeight: 1.7, color: t.subtitle,
    whiteSpace: "pre-wrap" as const, maxWidth: 780,
    fontFamily: t.font, flex: 1,
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
          <div style={{
            width: 48, height: 3, borderRadius: 2, marginBottom: 28,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
          }} />
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

/* ── Two Column ── */
function TwoColumnLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 34, fontWeight: 700, marginBottom: 12, lineHeight: 1.2,
    fontFamily: t.headingFont, letterSpacing: "-0.02em", color: t.text,
  };
  const colStyle: React.CSSProperties = {
    fontSize: 18, lineHeight: 1.65, color: t.subtitle,
    whiteSpace: "pre-wrap" as const, fontFamily: t.font, flex: 1,
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
          <div style={{
            width: 48, height: 3, borderRadius: 2, marginBottom: 32,
            background: `linear-gradient(90deg, ${t.accent}, ${t.accentAlt})`,
          }} />
        </>
      )}
      <div style={{ display: "flex", gap: 32, flex: 1 }}>
        <div style={{
          flex: 1, padding: "20px 24px", borderRadius: 12,
          backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
        }}>
          <EditableText
            value={slide.content || ""}
            placeholder={edit ? "Left column..." : "Left column"}
            onChange={edit?.onContentChange}
            style={colStyle}
          />
        </div>
        <div style={{
          flex: 1, padding: "20px 24px", borderRadius: 12,
          backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
        }}>
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

/* ── Quote ── */
function QuoteLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const quoteStyle: React.CSSProperties = {
    fontSize: 28, fontStyle: "italic" as const, lineHeight: 1.55,
    fontWeight: 400, letterSpacing: "0.005em",
    color: t.text, fontFamily: t.font, textAlign: "center" as const,
  };
  const attrStyle: React.CSSProperties = {
    fontSize: 16, color: t.subtitle, fontStyle: "normal" as const,
    fontWeight: 500, letterSpacing: "0.03em", textAlign: "center" as const,
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <div style={{
        fontSize: 120, lineHeight: 0.6, fontFamily: "Georgia, serif",
        color: t.accent, opacity: 0.3, marginBottom: 12, fontWeight: 700,
      }}>
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

/* ── Blank / Default ── */
function BlankLayout({ slide, t, edit }: { slide: DeckSlide; t: ThemeConfig; edit?: SlideEditHandlers }) {
  const headingStyle: React.CSSProperties = {
    fontSize: 34, fontWeight: 700, marginBottom: 24, lineHeight: 1.2,
    fontFamily: t.headingFont, letterSpacing: "-0.02em", color: t.text,
  };
  const contentStyle: React.CSSProperties = {
    fontSize: 20, lineHeight: 1.65, color: t.subtitle,
    whiteSpace: "pre-wrap" as const, fontFamily: t.font, flex: 1,
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
