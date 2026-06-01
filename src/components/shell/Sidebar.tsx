"use client";

/**
 * Sidebar — slim, ICON-ONLY rail on the warm canvas (not a card), 52px wide.
 *
 * No text labels (they took too much space) — each icon reveals its label as a
 * dim tooltip on hover (the usual pattern). Items: Projects · Search · New,
 * with Settings pinned bottom.
 *
 *  - Projects → returns to the all-projects list (clears current project/entity,
 *               same `goGlobalHome` the logo + breadcrumb use). Active only there.
 *  - Search   → dispatches `primy:open-search` (AppShell listens).
 *  - New      → createProject + switches to it.
 *  - Settings → opens the existing SettingsModal.
 *
 * Icon center aligns with the TopBar logo (row pad-left 10 + 52/2 = 36).
 */

import { useState } from "react";
import { LayoutGrid, Search, Plus, Settings } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { goGlobalHome } from "@/components/shell/Breadcrumb";

const HEAT = "#1A1815";

export function Sidebar() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const createProject = useAppStore((s) => s.createProject);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const atProjects = !currentProjectId; // all-projects level
  const openSearch = () => window.dispatchEvent(new Event("primy:open-search"));
  const newProject = () => createProject("Untitled project");

  return (
    <>
      <aside
        data-sidebar
        className="flex flex-col items-center py-1 gap-1.5 flex-shrink-0"
        style={{ width: 52 }}
      >
        <SidebarItem icon={<LayoutGrid size={18} />} label="Projects" active={atProjects} onClick={goGlobalHome} />
        <SidebarItem icon={<Search size={18} />} label="Search" onClick={openSearch} />
        <SidebarItem icon={<Plus size={19} />} label="New project" onClick={newProject} />
        <div className="flex-1" />
        <SidebarItem icon={<Settings size={18} />} label="Settings" onClick={() => setSettingsOpen(true)} />
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className="flex items-center justify-center rounded-[10px] active:scale-[0.96] transition-[background-color,color,transform] duration-[140ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{
          width: 40,
          height: 40,
          color: active ? HEAT : "#7a776f",
          background: active ? "#fff" : "transparent",
          boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.045)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        {icon}
      </button>

      {/* Hover label — dim dark tooltip to the right (appears on hover only). */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-[46px] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{ background: "rgba(26,26,26,0.92)", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}
      >
        {label}
      </span>
    </div>
  );
}
