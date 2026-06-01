"use client";

/**
 * STANDALONE PREVIEW — fixed top-bar + floating panes (PRD Direction A).
 *
 * Not wired into the app. Demonstrates the navigation model across THREE
 * levels — Home (all projects) → Project (one project's home) → File. The
 * frame (top bar + sidebar) sits on the warm canvas; chat + work pane float.
 *
 * Sidebar is Home · Search · New · Settings — "Projects" was redundant with
 * Home (both = the list of all projects), so Home owns that. The logo also
 * returns Home; the breadcrumb Project ▾ switches projects without leaving.
 *
 * Visit /preview/topbar. Delete this file to scrap.
 */

import { useState } from "react";
import {
  Home,
  Search,
  Plus,
  Settings,
  Brain,
  Share2,
  ChevronDown,
  Check,
  FileText,
  Table2,
  Presentation,
  LayoutTemplate,
  Undo2,
  Redo2,
  Cloud,
  Maximize2,
  Eye,
  Code2,
  ArrowUp,
} from "lucide-react";

const HEAT = "#ff4a00";
const CANVAS = "#ecebe6";
const BORDER = "rgba(0,0,0,0.08)";
const BORDER_FAINT = "rgba(0,0,0,0.05)";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06)";

const ENTITY = {
  doc: { color: "#2a6dfb", bg: "#f0f4fd", Icon: FileText, label: "Document" },
  sheet: { color: "#42c366", bg: "#eafaef", Icon: Table2, label: "Spreadsheet" },
  deck: { color: "#fa5d19", bg: "#fde8dc", Icon: Presentation, label: "Presentation" },
  page: { color: "#9061ff", bg: "#f3eeff", Icon: LayoutTemplate, label: "Page" },
} as const;

const FILES = [
  { id: "p1", type: "page" as const, title: "Acme Rebrand — Visual", meta: "edited 11m ago · DE" },
  { id: "d1", type: "deck" as const, title: "Kickoff Deck", meta: "edited 26m ago · DE" },
  { id: "s1", type: "sheet" as const, title: "Launch Budget", meta: "edited 31m ago · MC" },
  { id: "k1", type: "doc" as const, title: "Creative Brief", meta: "edited 41m ago · DE" },
];

const PROJECTS = [
  { name: "Acme Rebrand — Q3 Launch", accent: "#ff4a00", initial: "A", purpose: "Rebrand strategy, launch budget, and the kickoff deck.", meta: "4 files · edited 11m ago", members: ["DE", "MC"], status: "Active" },
  { name: "Product Strategy 2026", accent: "#2a6dfb", initial: "P", purpose: "Three bets, one north star — activated teams.", meta: "4 files · edited 2h ago", members: ["DE"], status: "Active" },
  { name: "Content Engine", accent: "#9061ff", initial: "C", purpose: "Plan, produce, and report from one place.", meta: "4 files · edited 2h ago", members: ["DE"], status: "Active" },
];

type View = "projects" | "project" | "file";

export default function TopBarPreview() {
  const [view, setView] = useState<View>("projects");
  const [projectDd, setProjectDd] = useState(false);
  const [fileDd, setFileDd] = useState(false);

  const closeDd = () => { setProjectDd(false); setFileDd(false); };
  const inFile = view === "file";
  const inProjectScope = view === "project" || view === "file"; // inside a project

  return (
    <div
      className="fixed inset-0 flex flex-col text-[#171717] overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", background: CANVAS }}
      onClick={closeDd}
    >
      {/* ───────── ZONE 1 — Top bar (on the canvas) ───────── */}
      <header className="flex items-center gap-2.5 pl-4 pr-3 flex-shrink-0" style={{ height: 56 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setView("projects"); }}
          title="Home — all projects"
          className="flex items-center justify-center rounded-[9px] text-white font-bold flex-shrink-0 active:scale-95 transition-transform"
          style={{ width: 30, height: 30, background: HEAT, fontSize: 15 }}
        >
          D
        </button>

        {/* Breadcrumb: Home → Project ▾ → File ▾ */}
        <nav className="flex items-center gap-0.5 text-[13.5px] ml-1">
          {!inProjectScope ? (
            <span className="font-medium px-2 text-[#171717]">Home</span>
          ) : (
            <BreadcrumbButton
              label="Acme Rebrand — Q3 Launch"
              open={projectDd}
              onToggle={(e) => { e.stopPropagation(); setProjectDd((v) => !v); setFileDd(false); }}
              accent={HEAT}
              heading="Switch project"
              items={[
                { label: "Acme Rebrand — Q3 Launch", current: true, onSelect: () => setView("project") },
                { label: "Product Strategy 2026", onSelect: () => setView("project") },
                { label: "Content Engine", onSelect: () => setView("project") },
                { label: "All projects…", action: true, accent: "#737373", onSelect: () => setView("projects") },
              ]}
            />
          )}
          {inFile && (
            <>
              <span className="text-[#b9b6b0] select-none px-0.5">/</span>
              <BreadcrumbButton
                label="Acme Rebrand — Visual"
                open={fileDd}
                onToggle={(e) => { e.stopPropagation(); setFileDd((v) => !v); setProjectDd(false); }}
                accent="#9061ff"
                icon={<LayoutTemplate size={13} className="text-[#9061ff]" />}
                heading="Open files"
                items={[
                  { label: "Acme Rebrand — Visual", current: true, icon: "page" },
                  { label: "Launch Budget", icon: "sheet" },
                  { label: "All files…", action: true, accent: "#737373" },
                ]}
              />
            </>
          )}
        </nav>

        {inFile && (
          <div className="flex items-center gap-1.5 ml-1.5 text-[#9a968f]">
            <Cloud size={13} />
            <span className="text-[11.5px]">Saved</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {inFile && (
            <>
              <IconGhost title="Undo"><Undo2 size={15} /></IconGhost>
              <IconGhost title="Redo"><Redo2 size={15} /></IconGhost>
              <div className="w-px h-5 mx-1" style={{ background: "rgba(0,0,0,0.1)" }} />
            </>
          )}
          {inProjectScope && (
            <button className="flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] text-[12.5px] font-medium text-[#525252] hover:bg-black/[0.05] transition-colors" title="Project Brain — what Primy knows about this project">
              <Brain size={14} className="text-[#9061ff]" />
              Brain
            </button>
          )}
          <button className="flex items-center gap-1.5 h-[30px] px-3 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: HEAT }}>
            <Share2 size={13} />
            Share
          </button>
          <div className="flex items-center justify-center rounded-full text-white text-[11px] font-semibold ml-1" style={{ width: 28, height: 28, background: "#1a1a1a" }}>DE</div>
        </div>
      </header>

      {/* Row: sidebar (on canvas) · chat (card) · work pane (card) */}
      <div className="flex flex-1 min-h-0" style={{ gap: 10, padding: "0 10px 10px 0" }}>
        {/* ZONE 2 — Sidebar ON the canvas */}
        <aside className="flex flex-col items-center py-1 gap-1 flex-shrink-0" style={{ width: 68 }}>
          <SidebarItem icon={<Home size={19} />} label="Home" active={!inProjectScope} onClick={() => setView("projects")} />
          <SidebarItem icon={<Search size={19} />} label="Search" />
          <SidebarItem icon={<Plus size={19} />} label="New" />
          <div className="flex-1" />
          <SidebarItem icon={<Settings size={19} />} label="Settings" />
        </aside>

        {/* ZONE 3 — Chat (floating card) */}
        <section
          className="flex flex-col flex-shrink-0"
          style={{ width: "25vw", minWidth: 320, maxWidth: 420, background: "#fff", borderRadius: 16, boxShadow: CARD_SHADOW, border: `1px solid ${BORDER_FAINT}`, overflow: "hidden" }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed text-[#2d2d2d]" style={{ background: "#faf9f7", border: `1px solid ${BORDER_FAINT}` }}>
              {view === "projects"
                ? <>Welcome back, Deepak. Pick a project to dive in, or tell me what you want to build.</>
                : <>Hi! I&apos;ve got the full context for <b>Acme Rebrand</b> — the brief, budget, and deck. What do you want to work on?</>}
            </div>
            <div className="flex flex-col gap-1.5 mt-3">
              {(view === "projects"
                ? ["Start a new project", "What changed across my projects this week?", "Find the Launch Budget"]
                : inFile
                  ? ["Make this page more visual", "Add a stats callout row", "Tighten the copy"]
                  : ["Turn the Creative Brief into a visual page", "Summarize the launch budget", "Draft the all-hands update"]
              ).map((s) => (
                <button key={s} className="text-left text-[13px] text-[#525252] rounded-lg px-3 py-2 hover:bg-[#f5f5f5] transition-colors" style={{ border: `1px solid ${BORDER}` }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Input — mirrors the real ChatInput */}
          <div className="px-3 pb-4 pt-2">
            <div className="relative rounded-[20px] bg-white" style={{ border: "1px solid #e8e8ed", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div className="px-5 pt-4 pb-14 text-[14px] tracking-[-0.01em] text-[#a3a3a3]">Ask anything... (type @ to mention)</div>
              <button className="absolute bottom-3 left-3.5 w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#737373] hover:bg-[#f5f5f3] transition-colors" style={{ border: "1px solid #e8e8ed" }}>
                <Plus size={16} strokeWidth={1.8} />
              </button>
              <button className="absolute bottom-3 right-3.5 w-8 h-8 rounded-full text-white flex items-center justify-center" style={{ background: HEAT }}>
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </section>

        {/* ZONE 4 — Work pane (floating card) */}
        <main className="flex-1 min-w-0 flex flex-col" style={{ background: "#fff", borderRadius: 16, boxShadow: CARD_SHADOW, border: `1px solid ${BORDER_FAINT}`, overflow: "hidden" }}>
          {view === "projects" && <GlobalHomeView onOpenProject={() => setView("project")} />}
          {view === "project" && <ProjectHomeView onOpenFile={() => setView("file")} />}
          {view === "file" && <FileView />}
        </main>
      </div>
    </div>
  );
}

/* ───────── Work pane: HOME — all projects (sidebar Home) ───────── */
function GlobalHomeView({ onOpenProject }: { onOpenProject: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-12 py-9">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Home</h1>
        <p className="text-[14px] text-[#737373] mt-1">Pick up where you left off, or start something new.</p>

        <div className="flex items-center justify-between mt-8 mb-3">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Your projects</span>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium text-white" style={{ background: HEAT }}>
            <Plus size={14} /> New project
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PROJECTS.map((p) => (
            <div
              key={p.name}
              onClick={onOpenProject}
              className="rounded-2xl bg-white p-4 cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ border: `1px solid ${BORDER}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)")}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center rounded-xl text-white font-semibold flex-shrink-0" style={{ width: 38, height: 38, background: p.accent, fontSize: 16 }}>{p.initial}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] truncate">{p.name}</h3>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#eafaef", color: "#2e9e47" }}>{p.status}</span>
                  </div>
                  <p className="text-[12.5px] text-[#737373] mt-1 leading-snug line-clamp-1">{p.purpose}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11.5px] text-[#a3a3a3] tabular-nums">{p.meta}</span>
                <div className="flex -space-x-1.5">
                  {p.members.map((m, i) => (
                    <div key={m} className="flex items-center justify-center rounded-full text-white text-[9px] font-semibold ring-2 ring-white" style={{ width: 22, height: 22, background: i === 0 ? "#1a1a1a" : "#6b6b6b" }}>{m}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-9">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Recent activity</span>
          <div className="mt-3 space-y-2.5">
            {[
              ["DE", "created the Acme Rebrand — Visual page", "11m ago"],
              ["MC", "edited Launch Budget", "31m ago"],
              ["DE", "created Product Strategy 2026", "2h ago"],
            ].map(([who, what, when], i) => (
              <div key={i} className="flex items-center gap-3 text-[13px]">
                <div className="flex items-center justify-center rounded-full text-white text-[9px] font-semibold flex-shrink-0" style={{ width: 22, height: 22, background: "#1a1a1a" }}>{who}</div>
                <span className="text-[#3d3d3d]"><b className="font-medium">{who === "DE" ? "You" : "Maya"}</b> {what}</span>
                <span className="text-[#b0ada6] text-[12px] tabular-nums">{when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Work pane: PROJECT home — one project's overview + files ───────── */
function ProjectHomeView({ onOpenFile }: { onOpenFile: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-12 py-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: HEAT }} />
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Acme Rebrand — Q3 Launch</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#eafaef", color: "#2e9e47" }}>Active</span>
            </div>
            <p className="text-[14px] text-[#525252] mt-1.5 max-w-[560px]">
              The approachable expert: rebrand strategy, launch budget, and the kickoff deck — one source of truth.
            </p>
            <div className="flex items-center gap-2 mt-3 text-[12px] text-[#a3a3a3]">
              <span>Client: Acme Inc.</span><span>·</span><span>Launch Sept 30</span><span>·</span>
              <span className="tabular-nums">4 files</span><span>·</span><span>edited 11m ago</span>
            </div>
          </div>
          <div className="flex -space-x-2 flex-shrink-0">
            {["DE", "MC"].map((n, i) => (
              <div key={n} className="flex items-center justify-center rounded-full text-white text-[10px] font-semibold ring-2 ring-white" style={{ width: 28, height: 28, background: i === 0 ? "#1a1a1a" : "#6b6b6b" }}>{n}</div>
            ))}
            <div className="flex items-center justify-center rounded-full text-[#737373] text-[12px] ring-2 ring-white" style={{ width: 28, height: 28, background: "#f0efec" }}>+</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-7">
          {["All files", "Documents", "Sheets", "Decks", "Pages"].map((c, i) => (
            <span key={c} className="text-[12px] px-3 py-[5px] rounded-full" style={i === 0 ? { background: "#1a1a2e", color: "#fff" } : { border: `1px solid ${BORDER}`, color: "#5a5852" }}>{c}</span>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {FILES.map((f) => {
            const e = ENTITY[f.type];
            return (
              <div key={f.id} onClick={onOpenFile} className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: e.bg }}>
                <div className="m-3 rounded-xl bg-white h-[96px] flex items-center justify-center" style={{ border: `1px solid ${BORDER_FAINT}` }}>
                  <e.Icon size={26} style={{ color: e.color, opacity: 0.55 }} />
                </div>
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <e.Icon size={13} style={{ color: e.color, opacity: 0.7 }} />
                    <span className="text-[11px] text-[#a09d96]">{e.label}</span>
                  </div>
                  <div className="text-[14px] font-semibold tracking-[-0.01em]">{f.title}</div>
                  <div className="text-[11px] text-[#b0ada6] mt-0.5">{f.meta}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Work pane: an open file (HTML visual page) ───────── */
function FileView() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ height: 42, borderBottom: `1px solid ${BORDER_FAINT}` }}>
        <div className="inline-flex items-center rounded-lg p-0.5" style={{ background: "#f4f3f0" }}>
          <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[6px] text-[12px] font-medium bg-white text-[#171717]" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}><Eye size={13} /> Preview</span>
          <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[6px] text-[12px] font-medium text-[#737373]"><Code2 size={13} /> HTML</span>
        </div>
        <span className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] font-medium text-[#525252] hover:bg-[#f5f5f5]"><Maximize2 size={13} /> Present</span>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ background: "#fafafa" }}>
        <div className="max-w-[640px] mx-auto px-7 py-8">
          <div className="rounded-2xl px-7 py-7 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${HEAT} 0%, #ff7a45 100%)` }}>
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase opacity-90">Creative Brief</div>
            <div className="text-[26px] font-bold tracking-[-0.02em] mt-2">Acme Rebrand — at a glance</div>
            <div className="text-[14px] opacity-90 mt-1.5">The approachable expert: sharp, warm, human.</div>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
          </div>
          <div className="grid grid-cols-3 gap-3 -mt-5 px-2 relative">
            {[["+25%", "Demo conversion"], ["$72k", "Launch budget"], ["Sept 30", "Go-live"]].map(([v, l]) => (
              <div key={l} className="bg-white rounded-xl px-4 py-3.5" style={{ border: `1px solid ${BORDER_FAINT}`, boxShadow: "0 6px 18px rgba(0,0,0,0.05)" }}>
                <div className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: HEAT }}>{v}</div>
                <div className="text-[11.5px] text-[#737373] mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[["Problem", "Dated & enterprise-heavy"], ["Idea", "The approachable expert"], ["Deliverables", "Identity → Site → Deck"], ["Success", "Conversion, in 60 days"]].map(([tag, h]) => (
              <div key={tag} className="bg-white rounded-xl p-4" style={{ border: `1px solid ${BORDER_FAINT}` }}>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fff1ec", color: HEAT }}>{tag}</span>
                <div className="text-[14px] font-semibold mt-2">{h}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type CrumbItem = { label: string; current?: boolean; action?: boolean; accent?: string; icon?: "page" | "sheet"; onSelect?: () => void };

function BreadcrumbButton({
  label, open, onToggle, items, accent, icon, heading,
}: {
  label: string;
  open: boolean;
  onToggle: (e: React.MouseEvent) => void;
  items: CrumbItem[];
  accent: string;
  icon?: React.ReactNode;
  heading?: string;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 h-[30px] px-2 rounded-[8px] hover:bg-black/[0.05] transition-colors max-w-[260px]"
        style={{ background: open ? "rgba(0,0,0,0.05)" : "transparent" }}
      >
        {icon}
        <span className="truncate font-medium">{label}</span>
        <ChevronDown size={13} className="text-[#a3a3a3] flex-shrink-0" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="absolute top-[38px] left-0 w-[248px] rounded-xl bg-white p-1.5 z-50" style={{ boxShadow: "0 12px 36px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)" }} onClick={(e) => e.stopPropagation()}>
          {heading && <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{heading}</div>}
          {items.map((it) => (
            <div
              key={it.label}
              onClick={() => it.onSelect?.()}
              className="px-2.5 py-[7px] rounded-lg text-[12.5px] hover:bg-[#f5f5f5] cursor-pointer flex items-center gap-2"
              style={{ color: it.action ? (it.accent ?? "#3d3d3d") : "#3d3d3d", fontWeight: it.action ? 500 : 400 }}
            >
              {it.icon === "page" && <LayoutTemplate size={13} className="text-[#9061ff]" />}
              {it.icon === "sheet" && <Table2 size={13} className="text-[#42c366]" />}
              <span className="flex-1 truncate">{it.label}</span>
              {it.current && <Check size={13} style={{ color: accent }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="flex flex-col items-center justify-center gap-1 rounded-[12px] transition-colors"
      style={{ width: 56, height: 52, background: active ? "#fff" : "transparent", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined, color: active ? HEAT : "#6f6c66" }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none" style={{ color: active ? HEAT : "#85827b" }}>{label}</span>
    </button>
  );
}

function IconGhost({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} className="flex items-center justify-center rounded-[8px] text-[#737373] hover:bg-black/[0.05] transition-colors" style={{ width: 30, height: 30 }}>
      {children}
    </button>
  );
}
