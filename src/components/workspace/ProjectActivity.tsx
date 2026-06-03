"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

interface ActivityEvent {
  id: string;
  verb: string;
  entityType: string | null;
  actorName: string | null;
  meta: Record<string, unknown>;
  createdAt: number;
}

const ENTITY_LABEL: Record<string, string> = {
  ku: "document",
  table: "sheet",
  deck: "deck",
  page: "page",
  folder: "folder",
};

function phrase(e: ActivityEvent): string {
  const who = e.actorName || "Someone";
  const what = e.entityType ? ENTITY_LABEL[e.entityType] || "item" : "item";
  switch (e.verb) {
    case "created": return `${who} created a ${what}`;
    case "deleted": return `${who} deleted a ${what}`;
    case "shared": return `${who} shared this with the org`;
    case "unshared": return `${who} made this private`;
    case "invited": return `${who} invited ${(e.meta?.email as string) || "a teammate"}`;
    case "joined": return `${who} joined`;
    default: return `${who} ${e.verb}`;
  }
}

function relTime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Compact recent-activity strip for the project home. Renders nothing when empty. */
export function ProjectActivity({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/activity`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.events) setEvents(d.events.slice(0, 5)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  if (events.length === 0) return null;

  return (
    <div
      className="mb-7 rounded-[12px] px-4 py-3"
      style={{ border: "1px solid var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <Activity className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Recent activity
        </span>
      </div>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="truncate" style={{ color: "var(--ink-2)" }}>{phrase(e)}</span>
            <span className="flex-shrink-0 tabular-nums" style={{ color: "var(--ink-3)" }}>{relTime(e.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
