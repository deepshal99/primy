"use client";

/**
 * Breadcrumb — store-wired port of the approved /preview/topbar breadcrumb.
 *
 * Renders on the warm canvas (transparent, not a card):
 *   Logo (heat "D") → global Home  ·  Project ▾  ·  / File ▾
 *
 * - Logo + "go home" clears the current project (same behavior the Sidebar
 *   Home item uses) so the work pane returns to the all-projects view.
 * - Project ▾ (shown inside a project) lists all projects with the current
 *   one checked, plus "+ New project" and "All projects…".
 * - File ▾ (shown only with an entity open) lists the project's files grouped
 *   by type, current checked, plus "Project home".
 *
 * Dropdowns are origin-aware (transform-origin: top left) and use the
 * `.menu-pop` motion utility (from src/styles/motion.css). They self-animate
 * even before motion.css lands via the Tailwind `animate-*`/`motion-reduce`
 * fallbacks below, and respect prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  Plus,
  FileText,
  Table2,
  Presentation,
  LayoutTemplate,
  Folder,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";

const HEAT = "#ff4a00";

const ENTITY: Record<
  EntityType,
  { color: string; Icon: typeof FileText; label: string; group: string }
> = {
  ku: { color: "#2a6dfb", Icon: FileText, label: "Document", group: "Documents" },
  table: { color: "#42c366", Icon: Table2, label: "Spreadsheet", group: "Sheets" },
  deck: { color: "#fa5d19", Icon: Presentation, label: "Presentation", group: "Decks" },
  page: { color: "#9061ff", Icon: LayoutTemplate, label: "Page", group: "Pages" },
};

/** Clear the current project → return to the global all-projects list. */
export function goGlobalHome() {
  const s = useAppStore.getState();
  if (s.currentProjectId) s.saveCurrentEntity();
  useAppStore.setState({
    currentProjectId: null,
    currentEntityId: null,
    currentEntityType: null,
    workspaceOpen: false,
  });
}

/** Clear just the open entity → return to the current project's home. */
function goProjectHome() {
  const s = useAppStore.getState();
  if (s.currentEntityId) s.saveCurrentEntity();
  useAppStore.setState({ currentEntityId: null, currentEntityType: null });
}

export interface BreadcrumbProps {
  /** Returns to the global all-projects home (logo / "All projects…"). */
  onGoHome?: () => void;
}

export function Breadcrumb({ onGoHome }: BreadcrumbProps) {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const switchProject = useAppStore((s) => s.switchProject);
  const createProject = useAppStore((s) => s.createProject);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDeck = useAppStore((s) => s.openDeck);
  const openPage = useAppStore((s) => s.openPage);

  const [menu, setMenu] = useState<null | "project" | "file">(null);

  const project = projects.find((p) => p.id === currentProjectId) || null;
  const inProjectScope = !!currentProjectId;
  const inFile = !!currentEntityId;

  const handleHome = () => {
    setMenu(null);
    if (onGoHome) onGoHome();
    else goGlobalHome();
  };

  const handlePickProject = (id: string) => {
    setMenu(null);
    if (id !== currentProjectId) switchProject(id);
    else goProjectHome();
  };

  const handleNewProject = () => {
    setMenu(null);
    createProject("New Project");
  };

  const handleOpenEntity = (id: string, type: EntityType) => {
    setMenu(null);
    if (id === currentEntityId) return;
    if (type === "ku") openKnowledgeUnit(id);
    else if (type === "table") openTable(id);
    else if (type === "deck") openDeck(id);
    else if (type === "page") openPage(id);
  };

  // Build the grouped file list for the current project.
  const fileGroups: { group: string; type: EntityType; items: { id: string; title: string }[] }[] =
    project
      ? [
          { group: "Documents", type: "ku" as const, items: project.knowledgeUnits.map((k) => ({ id: k.id, title: k.title })) },
          { group: "Sheets", type: "table" as const, items: project.tables.map((t) => ({ id: t.id, title: t.title })) },
          { group: "Decks", type: "deck" as const, items: (project.decks || []).map((d) => ({ id: d.id, title: d.title })) },
          { group: "Pages", type: "page" as const, items: (project.pages || []).map((p) => ({ id: p.id, title: p.title })) },
        ].filter((g) => g.items.length > 0)
      : [];

  const activeEntityTitle = (() => {
    if (!project || !currentEntityId) return "Untitled";
    for (const g of fileGroups) {
      const hit = g.items.find((i) => i.id === currentEntityId);
      if (hit) return hit.title;
    }
    return "Untitled";
  })();

  const activeAccent = currentEntityType ? ENTITY[currentEntityType].color : "#9061ff";

  // Breadcrumb trail — the logo lives in TopBar (aligned to the sidebar).
  return (
      <nav className="flex items-center gap-0.5 text-[13.5px] pl-0.5">
        {!inProjectScope ? (
          <span className="font-medium px-2 text-[#171717]">Projects</span>
        ) : (
          <CrumbMenu
            label={project?.title || "Project"}
            open={menu === "project"}
            onToggle={() => setMenu((m) => (m === "project" ? null : "project"))}
            onClose={() => setMenu(null)}
            accent={HEAT}
            heading="Switch project"
            icon={<Folder size={13} style={{ color: HEAT }} />}
          >
            {projects.map((p) => (
              <CrumbItem
                key={p.id}
                label={p.title}
                current={p.id === currentProjectId}
                accent={HEAT}
                onSelect={() => handlePickProject(p.id)}
              />
            ))}
            <CrumbDivider />
            <CrumbItem label="New project" action icon={<Plus size={13} className="text-[#737373]" />} onSelect={handleNewProject} />
            <CrumbItem label="All projects…" action accent="#737373" onSelect={handleHome} />
          </CrumbMenu>
        )}

        {inFile && (
          <>
            <span className="text-[#b9b6b0] select-none px-0.5">/</span>
            <CrumbMenu
              label={activeEntityTitle}
              open={menu === "file"}
              onToggle={() => setMenu((m) => (m === "file" ? null : "file"))}
              onClose={() => setMenu(null)}
              accent={activeAccent}
              heading="Open files"
              icon={currentEntityType ? (() => { const I = ENTITY[currentEntityType].Icon; return <I size={13} style={{ color: activeAccent }} />; })() : undefined}
            >
              {fileGroups.map((g) => {
                const Icon = ENTITY[g.type].Icon;
                return (
                  <div key={g.group}>
                    <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#b0ada6]">{g.group}</div>
                    {g.items.map((it) => (
                      <CrumbItem
                        key={it.id}
                        label={it.title}
                        current={it.id === currentEntityId}
                        accent={ENTITY[g.type].color}
                        icon={<Icon size={13} style={{ color: ENTITY[g.type].color }} />}
                        onSelect={() => handleOpenEntity(it.id, g.type)}
                      />
                    ))}
                  </div>
                );
              })}
              <CrumbDivider />
              <CrumbItem label="Project home" action accent="#737373" onSelect={() => { setMenu(null); goProjectHome(); }} />
            </CrumbMenu>
          </>
        )}
      </nav>
  );
}

/* ───────── Origin-aware dropdown shell ───────── */
function CrumbMenu({
  label,
  open,
  onToggle,
  onClose,
  accent,
  heading,
  icon,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  accent: string;
  heading?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="press flex items-center gap-1.5 h-[30px] px-2 rounded-[8px] hover:bg-black/[0.05] active:scale-[0.97] transition-[background-color,transform] motion-reduce:transition-none max-w-[260px]"
        style={{ background: open ? "rgba(0,0,0,0.05)" : "transparent", transitionDuration: "140ms" }}
        // accent kept for the active-glyph contract; harmless if unused
        data-accent={accent}
      >
        {icon}
        <span className="truncate font-medium text-[#171717]">{label}</span>
        <ChevronDown
          size={13}
          className="text-[#a3a3a3] flex-shrink-0"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s var(--ease-out, ease)" }}
        />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="menu-pop absolute top-[38px] left-0 w-[252px] max-h-[60vh] overflow-y-auto rounded-xl bg-white p-1.5 z-[50] motion-safe:animate-[crumbPop_160ms_var(--ease-out,cubic-bezier(0.23,1,0.32,1))]"
          style={{ transformOrigin: "top left", boxShadow: "0 12px 36px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)" }}
        >
          {heading && (
            <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{heading}</div>
          )}
          {children}
        </div>
      )}
      {/* Self-contained keyframes so the pop works before motion.css lands. */}
      <style jsx global>{`
        @keyframes crumbPop {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .menu-pop { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function CrumbItem({
  label,
  current,
  action,
  accent,
  icon,
  onSelect,
}: {
  label: string;
  current?: boolean;
  action?: boolean;
  accent?: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className="w-full px-2.5 py-[7px] rounded-lg text-[12.5px] hover:bg-[#f5f5f5] transition-colors cursor-pointer flex items-center gap-2 text-left"
      style={{ color: action ? accent ?? "#3d3d3d" : "#3d3d3d", fontWeight: action ? 500 : 400 }}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {current && <Check size={13} style={{ color: accent ?? HEAT }} />}
    </button>
  );
}

function CrumbDivider() {
  return <div className="h-px bg-[#f0eee9] mx-1 my-1" />;
}
