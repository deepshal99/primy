"use client";

import { useState, useRef } from "react";
import { PlateElement } from "platejs/react";
import { ENTITY_META } from "@/lib/entityMeta";
import { openEntity, useResolvedEntity } from "@/lib/entityLinks";
import type { EntityType } from "@/lib/types";
import { toast } from "sonner";
import { EntityHoverCard } from "./EntityHoverCard";

export function MentionElement(props: any) {
  const { element } = props;
  const entityType = element.entityType as EntityType;
  const entityId = element.entityId as string;
  const snapshotTitle = (element.value as string) || "Untitled";
  const resolved = useResolvedEntity(entityType, entityId);
  const exists = !!resolved;
  const title = resolved?.title || snapshotTitle;
  const meta = ENTITY_META[entityType] || ENTITY_META.ku;
  const Icon = meta.Icon;

  const [showCard, setShowCard] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (!exists) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShowCard(true); return; }
    hoverTimer.current = setTimeout(() => setShowCard(true), 300);
  };
  const onLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowCard(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!exists) {
      toast.error("This item no longer exists");
      return;
    }
    openEntity(entityType, entityId);
  };

  return (
    <PlateElement {...props} as="span" className="inline-block align-baseline">
      <span
        contentEditable={false}
        onClick={handleClick}
        role="link"
        tabIndex={0}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(e as any); }
        }}
        className={[
          "relative inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md",
          "text-[0.92em] font-medium leading-tight cursor-pointer select-none align-baseline",
          "transition-colors press",
          exists ? "" : "opacity-50 cursor-not-allowed line-through",
        ].join(" ")}
        style={
          exists
            ? { color: meta.color, backgroundColor: meta.bg }
            : { color: "var(--ink-muted, #B9B6AE)", backgroundColor: "rgba(24,24,22,0.04)" }
        }
        title={exists ? `Open ${meta.label.toLowerCase()}: ${title}` : "Item unavailable"}
      >
        <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
        <span>@{title}</span>
        {showCard && (
          <span
            contentEditable={false}
            className="absolute left-0 top-full mt-1 z-50"
            style={{ pointerEvents: "none" }}
          >
            <EntityHoverCard type={entityType} id={entityId} />
          </span>
        )}
      </span>
      {props.children}
    </PlateElement>
  );
}
