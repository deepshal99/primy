"use client";

import { ENTITY_META } from "@/lib/entityMeta";
import type { ProducedEntity } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { ArrowUpRight } from "lucide-react";

/**
 * Clickable cards under an assistant message, one per entity the AI turn
 * created or updated. Clicking opens the entity and reveals the workspace.
 *
 * Motion: the list wraps in `.stagger-in` (motion.css) so the cards cascade
 * in via the existing per-child nth-child delays — no new keyframes. On the
 * last assistant message (`pulse`), each card also fires the one-shot
 * `.success-pop` as a quiet "done" cue. Both degrade under reduced motion.
 */
export function ArtifactWidgetList({
  entities,
  pulse,
}: {
  entities: ProducedEntity[];
  pulse?: boolean;
}) {
  if (!entities.length) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-2.5 stagger-in">
      {entities.map((e) => (
        <ArtifactWidget key={e.id} entity={e} pulse={pulse} />
      ))}
    </div>
  );
}

function openProduced(entity: ProducedEntity) {
  const s = useAppStore.getState();
  switch (entity.type) {
    case "ku":
      s.openKnowledgeUnit(entity.id);
      break;
    case "table":
      s.openTable(entity.id);
      break;
    case "deck":
      s.openDeck(entity.id);
      break;
    case "page":
      s.openPage(entity.id);
      break;
  }
  // Ensure the workspace canvas is visible after opening from chat.
  useAppStore.setState({ workspaceOpen: true });
}

function ArtifactWidget({
  entity,
  pulse,
}: {
  entity: ProducedEntity;
  pulse?: boolean;
}) {
  const meta = ENTITY_META[entity.type] || ENTITY_META.ku;
  const Icon = meta.Icon;
  return (
    <button
      onClick={() => openProduced(entity)}
      className={`group/aw flex items-center gap-2.5 w-full max-w-[300px] px-3 py-2 rounded-[10px] text-left press hover-row ${
        pulse ? "success-pop" : ""
      }`}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-[8px] flex-shrink-0"
        style={{ background: meta.bg }}
      >
        <Icon
          className="w-4 h-4"
          strokeWidth={1.8}
          style={{ color: meta.color }}
          aria-hidden
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[13px] font-medium truncate"
          style={{ color: "var(--ink)" }}
        >
          {entity.title}
        </span>
        <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
          {meta.label} {entity.action === "created" ? "created" : "updated"}
        </span>
      </span>
      <ArrowUpRight
        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover/aw:opacity-100 t-fast"
        style={{ color: "var(--ink-3)" }}
        aria-hidden
      />
    </button>
  );
}
