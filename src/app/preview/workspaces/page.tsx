"use client";

/**
 * STANDALONE PREVIEW — the new "Workspaces" tab (replaces Library).
 *
 * The idea we're working out here:
 *   - The sidebar "Workspaces" tree becomes "Recents" (most-recent rail).
 *   - This full-surface "Workspaces" tab is the real directory: every workspace
 *     as a calm card with the signal that matters at a glance — a settable icon
 *     (brand logo / glyph / lettermark — never an emoji), what it is about, how
 *     many files, whether it is shared, and who is active.
 *   - Whatever icon a workspace gets here should also show in the sidebar
 *     Recents when it is open (future wiring — kept in mind, not built here).
 *
 * Design discipline: ONE identity accent per card (from the brand candy set:
 * blue / purple / teal / pink). No multi-colour entity bars, no coloured type
 * chips. Active = amber (the brand "active dot"). Tiles are neutral so a brand
 * logo is the one colourful focal point.
 *
 * Self-contained, mock data, not wired in. Visit /preview/workspaces. Light +
 * dark via the local toggle. Delete this folder to scrap.
 */

import { useMemo, useState } from "react";
import {
  Search, Plus, Users, Lock, Sun, Moon, LayoutGrid, Rows3, Star, ArrowUpDown,
  Rocket, Compass, FlaskConical, BarChart3, Briefcase, NotebookPen,
} from "lucide-react";

/* ───────────────────────── brand glyphs (settable icon demo) ───────────────────────── */

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.97 21.97 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z" />
    </svg>
  );
}
function VercelMark() {
  return (
    <svg viewBox="0 0 76 65" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M37.59.25l36.95 64H.64l36.95-64z" />
    </svg>
  );
}
function FigmaMark() {
  return (
    <svg viewBox="0 0 38 57" width="14" height="21" aria-hidden>
      <path fill="#1abcfe" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
      <path fill="#0acf83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
      <path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path fill="#f24e1e" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
      <path fill="#a259ff" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
    </svg>
  );
}

/* ───────────────────────── mock data ───────────────────────── */

type Member = { initials: string; color: string; active?: boolean };
// Identity accent — brand candy set only (no green/amber; those carry other
// meaning). `null` = a brand-logo card, which stays neutral so the logo pops.
type Accent = "#4285F4" | "#8757D7" | "#67CEC8" | "#F073A7" | null;
type Icon =
  | { kind: "brand"; node: React.ReactNode; tileInk?: string }
  | { kind: "glyph"; Glyph: typeof Rocket }
  | { kind: "letter"; char: string };

type Workspace = {
  id: string;
  name: string;
  about: string;
  type?: string;
  accent: Accent;
  icon: Icon;
  files: number;
  members: Member[];   // empty = private
  owner: boolean;      // created by me
  updated: string;
  pinned?: boolean;
};

const M = (initials: string, color: string, active = false): Member => ({ initials, color, active });

const WORKSPACES: Workspace[] = [
  {
    id: "google", name: "Google Brand Refresh", type: "Design",
    about: "Q3 brand system, ad creative, and the new partner pitch deck.",
    accent: null, icon: { kind: "brand", node: <GoogleG /> }, files: 18,
    members: [M("DM", "#8757D7", true), M("AR", "#4285F4", true), M("JS", "#F073A7", true), M("KP", "#67CEC8")],
    owner: true, updated: "2h ago", pinned: true,
  },
  {
    id: "launch", name: "Acme Product Launch", type: "Marketing",
    about: "Launch plan, landing page, email sequence, and the press one-pager.",
    accent: "#F073A7", icon: { kind: "glyph", Glyph: Rocket }, files: 12,
    members: [M("DM", "#8757D7"), M("TW", "#67CEC8", true), M("LM", "#4285F4")],
    owner: true, updated: "5h ago", pinned: true,
  },
  {
    id: "vercel", name: "Vercel Migration", type: "Engineering",
    about: "Infra migration runbook, cost model, and rollout timeline.",
    accent: null, icon: { kind: "brand", node: <VercelMark />, tileInk: "var(--ink)" }, files: 24,
    members: [M("DM", "#8757D7"), M("AR", "#4285F4", true), M("NK", "#F073A7"), M("BV", "#67CEC8", true), M("ZP", "#8757D7")],
    owner: false, updated: "1d ago",
  },
  {
    id: "design", name: "Design System", type: "Design",
    about: "Component library audit, tokens, and the handoff spec.",
    accent: null, icon: { kind: "brand", node: <FigmaMark /> }, files: 15,
    members: [M("DM", "#8757D7", true), M("EK", "#4285F4"), M("SD", "#F073A7", true)],
    owner: false, updated: "1d ago",
  },
  {
    id: "finance", name: "Q4 Financial Model", type: "Finance",
    about: "Revenue model, hiring plan, and the board update.",
    accent: "#67CEC8", icon: { kind: "glyph", Glyph: BarChart3 }, files: 9,
    members: [M("DM", "#8757D7"), M("CF", "#4285F4")],
    owner: true, updated: "2d ago",
  },
  {
    id: "content", name: "Content Calendar", type: "Content",
    about: "Editorial calendar, briefs, and the repurposing playbook.",
    accent: "#4285F4", icon: { kind: "letter", char: "C" }, files: 15,
    members: [M("DM", "#8757D7", true), M("HL", "#F073A7", true), M("RG", "#67CEC8", true)],
    owner: false, updated: "3d ago",
  },
  {
    id: "research", name: "Research Hub", type: "Research",
    about: "User interviews, competitive teardown, and synthesis docs.",
    accent: "#8757D7", icon: { kind: "glyph", Glyph: FlaskConical }, files: 31,
    members: [M("DM", "#8757D7"), M("PT", "#4285F4", true), M("YU", "#F073A7"), M("WE", "#67CEC8"), M("QA", "#8757D7"), M("ZX", "#4285F4")],
    owner: false, updated: "4d ago",
  },
  {
    id: "investor", name: "Investor Updates", type: "Finance",
    about: "Monthly investor memos and the metrics dashboard.",
    accent: "#67CEC8", icon: { kind: "glyph", Glyph: Briefcase }, files: 5,
    members: [], owner: true, updated: "1w ago",
  },
  {
    id: "personal", name: "Personal Notes",
    about: "Scratch space, reading list, and ideas to revisit.",
    accent: "#8757D7", icon: { kind: "glyph", Glyph: NotebookPen }, files: 6,
    members: [], owner: true, updated: "2w ago",
  },
];

/* ───────────────────────── icon tile ───────────────────────── */

/* Neutral card-coloured tile so colour comes only from the accent glyph or a
   brand logo, never from the tile itself. */
function WsIcon({ icon, accent, size = 48 }: { icon: Icon; accent: Accent; size?: number }) {
  const tile: React.CSSProperties = {
    width: size, height: size, borderRadius: Math.round(size * 0.3),
    background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(24,24,22,0.08)",
  };
  if (icon.kind === "brand") {
    return <span className="flex items-center justify-center flex-shrink-0" style={{ ...tile, color: icon.tileInk }}>{icon.node}</span>;
  }
  const color = accent ?? "var(--ink-2)";
  if (icon.kind === "letter") {
    return <span className="flex items-center justify-center flex-shrink-0 font-semibold" style={{ ...tile, color, fontSize: size * 0.4 }}>{icon.char}</span>;
  }
  const { Glyph } = icon;
  return <span className="flex items-center justify-center flex-shrink-0" style={{ ...tile, color }}><Glyph size={size * 0.44} strokeWidth={1.85} /></span>;
}

/* ───────────────────────── people ───────────────────────── */

function Avatars({ members, compact }: { members: Member[]; compact?: boolean }) {
  if (members.length === 0) {
    return <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-4)" }}><Lock size={12} /> Private</span>;
  }
  const shown = members.slice(0, compact ? 3 : 4);
  const extra = members.length - shown.length;
  const active = members.filter((m) => m.active).length;
  const sz = 26;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center">
        {shown.map((m, i) => (
          <span key={i} className="relative flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ width: sz, height: sz, background: m.color, marginLeft: i === 0 ? 0 : -8, boxShadow: "0 0 0 2px var(--card)", zIndex: shown.length - i }}>
            {m.initials}
            {m.active && <span className="absolute -bottom-0.5 -right-0.5 rounded-full" style={{ width: 8, height: 8, background: "var(--accent-amber, #FFB43F)", boxShadow: "0 0 0 2px var(--card)" }} />}
          </span>
        ))}
        {extra > 0 && (
          <span className="flex items-center justify-center rounded-full text-[10px] font-semibold tabular-nums"
            style={{ width: sz, height: sz, marginLeft: -8, background: "var(--sidebar-accent)", color: "var(--ink-3)", boxShadow: "0 0 0 2px var(--card)" }}>+{extra}</span>
        )}
      </div>
      {active > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums" style={{ color: "var(--ink-3)" }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: "var(--accent-amber, #FFB43F)" }} /> {active} active
        </span>
      )}
    </div>
  );
}

function PinButton({ pinned, onClick }: { pinned: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title={pinned ? "Unpin" : "Pin"}
      className={`flex items-center justify-center w-8 h-8 rounded-[8px] press hover-row transition-opacity ${pinned ? "" : "opacity-0 group-hover:opacity-100"}`}
      style={{ color: pinned ? "var(--accent-amber)" : "var(--ink-4)" }}>
      <Star size={15} fill={pinned ? "var(--accent-amber)" : "none"} />
    </button>
  );
}

/* ───────────────────────── card (default) ───────────────────────── */

function WsCard({ ws, index, onTogglePin }: { ws: Workspace; index: number; onTogglePin: () => void }) {
  const stage = ws.accent
    ? `linear-gradient(160deg, color-mix(in srgb, ${ws.accent} 13%, var(--card)) 0%, var(--card) 76%)`
    : `linear-gradient(160deg, var(--sidebar-accent) 0%, var(--card) 80%)`;
  return (
    <div className="group relative flex flex-col rounded-[16px] overflow-hidden cursor-pointer lift animate-fade-in-up"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${Math.min(index, 16) * 26}ms` }}>
      {/* stage — soft single-accent wash with the workspace icon */}
      <div className="relative flex items-center px-5" style={{ height: 92, background: stage }}>
        <WsIcon icon={ws.icon} accent={ws.accent} size={52} />
        <div className="absolute top-2.5 right-2.5">
          <PinButton pinned={!!ws.pinned} onClick={(e) => { e.stopPropagation(); onTogglePin(); }} />
        </div>
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 px-5 pt-3.5 pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--ink)" }}>{ws.name}</h3>
          {!ws.owner && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 h-[18px] rounded-full"
              style={{ background: "var(--sidebar-accent)", color: "var(--ink-3)" }}><Users size={9} /> Shared</span>
          )}
        </div>
        <p className="text-[12.5px] mt-1 line-clamp-2 min-h-[35px]" style={{ color: "var(--ink-4)" }}>{ws.about}</p>

        <div className="flex items-center justify-between gap-3 mt-3.5 pt-3.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-3)" }}>
            {ws.files} {ws.files === 1 ? "file" : "files"} · {ws.updated}
          </span>
          <Avatars members={ws.members} compact />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── list row (calm alternate) ───────────────────────── */

const ROW_GRID = "48px minmax(0,1fr) 80px 190px 84px 32px";

function ListRow({ ws, index, first, onTogglePin }: { ws: Workspace; index: number; first: boolean; onTogglePin: () => void }) {
  return (
    <div className="group grid items-center px-5 cursor-pointer animate-fade-in-up transition-colors hover:bg-[var(--sidebar-accent)]"
      style={{ gridTemplateColumns: ROW_GRID, columnGap: 18, minHeight: 76, borderTop: first ? undefined : "1px solid var(--border)", animationDelay: `${Math.min(index, 16) * 24}ms` }}>
      <WsIcon icon={ws.icon} accent={ws.accent} size={42} />
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--ink)" }}>{ws.name}</h3>
          {!ws.owner && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 h-[18px] rounded-full"
              style={{ background: "var(--sidebar-accent)", color: "var(--ink-3)" }}><Users size={9} /> Shared</span>
          )}
        </div>
        <p className="text-[12.5px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>{ws.about}</p>
      </div>
      <span className="text-[13px] tabular-nums" style={{ color: "var(--ink-2)" }}>{ws.files} <span className="text-[11.5px]" style={{ color: "var(--ink-4)" }}>files</span></span>
      <Avatars members={ws.members} />
      <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-4)" }}>{ws.updated}</span>
      <PinButton pinned={!!ws.pinned} onClick={(e) => { e.stopPropagation(); onTogglePin(); }} />
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

type Filter = "all" | "owned" | "shared";

export default function WorkspacesPreview() {
  const [dark, setDark] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [pins, setPins] = useState<Record<string, boolean>>(() => Object.fromEntries(WORKSPACES.map((w) => [w.id, !!w.pinned])));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return WORKSPACES.filter((w) => {
      if (filter === "owned" && !w.owner) return false;
      if (filter === "shared" && w.owner) return false;
      if (needle && !w.name.toLowerCase().includes(needle) && !w.about.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [filter, q]);

  const pinned = filtered.filter((w) => pins[w.id]);
  const rest = filtered.filter((w) => !pins[w.id]);
  const togglePin = (id: string) => setPins((p) => ({ ...p, [id]: !p[id] }));

  const counts = { all: WORKSPACES.length, owned: WORKSPACES.filter((w) => w.owner).length, shared: WORKSPACES.filter((w) => !w.owner).length };
  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "owned", label: "Created by me" },
    { key: "shared", label: "Shared with me" },
  ];

  function Group({ items, offset }: { items: Workspace[]; offset: number }) {
    if (layout === "list") {
      return (
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          {items.map((w, i) => <ListRow key={w.id} ws={{ ...w, pinned: pins[w.id] }} index={offset + i} first={i === 0} onTogglePin={() => togglePin(w.id)} />)}
        </div>
      );
    }
    return (
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(284px, 1fr))" }}>
        {items.map((w, i) => <WsCard key={w.id} ws={{ ...w, pinned: pins[w.id] }} index={offset + i} onTogglePin={() => togglePin(w.id)} />)}
      </div>
    );
  }

  return (
    <div className={dark ? "dark" : ""}>
      <div className="fixed inset-0 overflow-y-auto v2-scroll"
        style={{ background: "var(--canvas)", color: "var(--ink)", fontFamily: "Inter, system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
        <div className="max-w-[1120px] mx-auto px-12 pt-20 pb-24">

          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.04em]" style={{ color: "var(--ink)" }}>Workspaces</h1>
              <p className="text-[15px] mt-3 max-w-[460px]" style={{ color: "var(--ink-3)" }}>Every workspace you own or share, with what is inside and who is in it.</p>
            </div>
            <div className="flex items-center gap-2.5 pt-1.5">
              <button onClick={() => setDark((v) => !v)} title="Toggle theme"
                className="flex items-center justify-center w-10 h-10 rounded-[10px] press" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--icon)" }}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button className="inline-flex items-center gap-2 h-10 pl-3.5 pr-5 rounded-[10px] text-[13.5px] font-medium press lift text-white" style={{ background: "var(--ink)" }}>
                <Plus size={17} /> New workspace
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-4 mt-12 mb-7">
            <div className="flex items-center gap-1">
              {TABS.map((t) => {
                const on = filter === t.key;
                return (
                  <button key={t.key} onClick={() => setFilter(t.key)}
                    className={`h-9 pl-4 pr-3 rounded-full text-[13px] font-medium press inline-flex items-center gap-1.5 ${!on ? "hover-row" : ""}`}
                    style={on ? { background: "var(--sidebar-accent)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>
                    {t.label}<span className="text-[11.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{counts[t.key]}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 h-9 px-3.5 rounded-full" style={{ background: "var(--sidebar-accent)" }}>
                <Search size={14} style={{ color: "var(--ink-4)" }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a workspace"
                  className="w-[150px] bg-transparent outline-none text-[12.5px] placeholder:text-[var(--ink-4)]" style={{ color: "var(--ink)" }} />
              </div>
              <button className="flex items-center gap-1.5 h-9 px-3 rounded-[9px] text-[12.5px] font-medium press hover-row" style={{ color: "var(--ink-3)" }}>
                <ArrowUpDown size={14} /> Recent
              </button>
              <div className="inline-flex items-center rounded-full p-1" style={{ background: "var(--sidebar-accent)" }}>
                {([["grid", LayoutGrid], ["list", Rows3]] as const).map(([m, Ic]) => {
                  const on = layout === m;
                  return (
                    <button key={m} onClick={() => setLayout(m)} className="flex items-center justify-center w-8 h-8 rounded-full press"
                      style={{ background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--icon)", boxShadow: on ? "0 1px 6px rgba(24,24,22,0.10)" : undefined }}>
                      <Ic size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-[18px] mb-5" style={{ background: "var(--sidebar-accent)", color: "var(--ink-4)" }}><Rocket size={26} /></div>
              <h3 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>No workspaces match</h3>
              <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-4)" }}>Try a different filter or search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {pinned.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3.5">
                    <Star size={13} fill="var(--accent-amber)" style={{ color: "var(--accent-amber)" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>Pinned</span>
                  </div>
                  <Group items={pinned} offset={0} />
                </div>
              )}
              {rest.length > 0 && (
                <div>
                  {pinned.length > 0 && <div className="mb-3.5"><span className="text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>All workspaces</span></div>}
                  <Group items={rest} offset={pinned.length} />
                </div>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-center mt-16" style={{ color: "var(--ink-4)" }}>Preview · mock data · /preview/workspaces</p>
        </div>
      </div>
    </div>
  );
}
