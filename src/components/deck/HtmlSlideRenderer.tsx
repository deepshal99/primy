"use client";

import { useRef, useEffect } from "react";

interface HtmlSlideRendererProps {
  html: string;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function HtmlSlideRenderer({ html, scale = 1, onClick, isActive }: HtmlSlideRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write HTML content to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 960px; height: 540px; overflow: hidden; }
  .slide { width: 960px; height: 540px; overflow: hidden; position: relative; box-sizing: border-box; }
</style>
</head>
<body>${html}</body>
</html>`);
    doc.close();
  }, [html]);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden select-none ${onClick ? "cursor-pointer" : ""}`}
      style={{
        width: 960 * scale,
        height: 540 * scale,
        borderRadius: 8 * scale,
        boxShadow: isActive
          ? "0 0 0 2px #3B82F6"
          : `0 ${1 * scale}px ${4 * scale}px rgba(0,0,0,0.08), 0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.04)`,
        transition: "box-shadow 0.15s",
      }}
    >
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        style={{
          width: 960,
          height: 540,
          border: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: scale < 0.5 ? "none" : "auto",
        }}
        title="Slide"
      />
    </div>
  );
}
