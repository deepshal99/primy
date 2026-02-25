"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { design } from "@/lib/design";

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_FACTOR = 1.2;

interface ZoomPanWrapperProps {
  children: React.ReactNode;
}

export function ZoomPanWrapper({ children }: ZoomPanWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Cursor position relative to container
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

      setScale((prev) => {
        const newScale = clampScale(prev * factor);
        const ratio = newScale / prev;

        setTranslate((t) => ({
          x: cx - (cx - t.x) * ratio,
          y: cy - (cy - t.y) * ratio,
        }));

        return newScale;
      });
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on left click, ignore if target is interactive
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
    },
    [translate]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leaving the container while panning
  useEffect(() => {
    if (!isPanning) return;
    const handleGlobalUp = () => setIsPanning(false);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, [isPanning]);

  // Prevent default wheel on the container element to avoid page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const newScale = clampScale(prev * ZOOM_FACTOR);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ratio = newScale / prev;
        setTranslate((t) => ({
          x: cx - (cx - t.x) * ratio,
          y: cy - (cy - t.y) * ratio,
        }));
      }
      return newScale;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = clampScale(prev / ZOOM_FACTOR);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ratio = newScale / prev;
        setTranslate((t) => ({
          x: cx - (cx - t.x) * ratio,
          y: cy - (cy - t.y) * ratio,
        }));
      }
      return newScale;
    });
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const pct = Math.round(scale * 100);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Transformed content */}
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {children}
      </div>

      {/* Floating zoom controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full px-1 py-0.5"
        style={{
          backgroundColor: design.colors.bg.elevated,
          border: `1px solid ${design.colors.border.default}`,
          boxShadow: design.shadows.md,
          height: "32px",
          zIndex: 10,
        }}
      >
        <ControlButton onClick={zoomOut} title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </ControlButton>

        <span
          className="text-[11px] font-medium tabular-nums min-w-[40px] text-center select-none"
          style={{ color: design.colors.text.secondary }}
        >
          {pct}%
        </span>

        <ControlButton onClick={zoomIn} title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </ControlButton>

        <div
          className="w-px h-4 mx-0.5"
          style={{ backgroundColor: design.colors.border.default }}
        />

        <ControlButton onClick={resetView} title="Reset view">
          <Maximize2 className="w-3.5 h-3.5" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
      className="flex items-center justify-center w-7 h-7 rounded-full transition-colors"
      style={{ color: design.colors.text.secondary }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = design.colors.bg.hover;
        e.currentTarget.style.color = design.colors.text.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = design.colors.text.secondary;
      }}
    >
      {children}
    </button>
  );
}
