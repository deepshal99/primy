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
import { ChevronDown, Check, Plus, Folder } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";
import { ENTITY_META } from "@/lib/entityMeta";

const HEAT = "#FFB43F";

const ENTITY = ENTITY_META;

// Navigation delegates to the store actions, which own the full reset (so no
// project/entity state bleeds across). Exported for the TopBar logo + Sidebar.
export function goGlobalHome() {
  useAppStore.getState().goToProjectsHome();
}
function goProjectHome() {
  useAppStore.getState().goToProjectHome();
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
            onPrimary={goProjectHome}
            primaryTitle="Go to project home"
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
  onPrimary,
  primaryTitle,
  accent,
  heading,
  icon,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** When set, clicking the name fires this (e.g. go to project home) and only
   *  the ▾ chevron opens the dropdown. Without it, the whole crumb toggles. */
  onPrimary?: () => void;
  primaryTitle?: string;
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
    <div className="relative flex items-center" ref={ref} data-accent={accent}>
      {onPrimary ? (
        // Split crumb: name → primary action (project home); ▾ → switcher.
        <div className="flex items-center rounded-[8px]" style={{ background: open ? "rgba(0,0,0,0.05)" : "transparent" }}>
          <button
            onClick={onPrimary}
            title={primaryTitle}
            className="press flex items-center gap-1.5 h-[30px] pl-2 pr-1 rounded-l-[8px] hover:bg-black/[0.05] active:scale-[0.98] transition-[background-color,transform] motion-reduce:transition-none max-w-[230px]"
            style={{ transitionDuration: "140ms" }}
          >
            {icon}
            <span className="truncate font-medium text-[#171717]">{label}</span>
          </button>
          <button
            onClick={onToggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Switch project"
            title="Switch project"
            className="press flex items-center justify-center h-[30px] w-[22px] rounded-r-[8px] hover:bg-black/[0.05] active:scale-[0.97] transition-[background-color,transform] motion-reduce:transition-none"
            style={{ transitionDuration: "140ms" }}
          >
            <ChevronDown
              size={13}
              className="text-[#a3a3a3]"
              style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s var(--ease-out, ease)" }}
            />
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="press flex items-center gap-1.5 h-[30px] px-2 rounded-[8px] hover:bg-black/[0.05] active:scale-[0.97] transition-[background-color,transform] motion-reduce:transition-none max-w-[260px]"
          style={{ background: open ? "rgba(0,0,0,0.05)" : "transparent", transitionDuration: "140ms" }}
        >
          {icon}
          <span className="truncate font-medium text-[#171717]">{label}</span>
          <ChevronDown
            size={13}
            className="text-[#a3a3a3] flex-shrink-0"
            style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s var(--ease-out, ease)" }}
          />
        </button>
      )}
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="menu-pop absolute top-[38px] left-0 w-[252px] max-h-[60vh] overflow-y-auto rounded-xl bg-white p-1.5 z-[50]"
          style={{ transformOrigin: "top left", boxShadow: "0 12px 36px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)" }}
        >
          {heading && (
            <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{heading}</div>
          )}
          {children}
        </div>
      )}
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
