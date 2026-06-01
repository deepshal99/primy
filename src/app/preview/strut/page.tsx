"use client";

/**
 * STANDALONE PREVIEW — Strut-style workspace shell for Primy.
 *
 * A faithful study of strut.so's UI/UX (warm palette, calm typography, labeled
 * sidebar, docked cream chat pane, board / kanban / timeline views, a NATIVE
 * unified editor shell) — reskinned for Primy's entities (doc / sheet / deck /
 * page) and the two gaps Strut exposed:
 *   1. Nested project → folder → entity hierarchy in the sidebar + board.
 *   2. One cohesive "editor shell" that wraps every entity type identically.
 *
 * Self-contained. Not wired into the app. Visit /preview/strut. Light + dark.
 * Delete this folder to scrap.
 */

import { useMemo, useState } from "react";
import {
  Inbox,
  PenLine,
  Search,
  ChevronRight,
  Plus,
  FileText,
  Table2,
  Presentation,
  LayoutTemplate,
  MoreHorizontal,
  Rows3,
  LayoutGrid,
  Columns3,
  CalendarDays,
  ArrowUp,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Maximize2,
  ArrowLeft,
  Type,
  Check,
  AudioLines,
  CircleHelp,
} from "lucide-react";

/* ───────────────────────── theme tokens ───────────────────────── */

type Theme = typeof LIGHT;

const LIGHT = {
  // Pragcel-style: near-white product shell, black brand, controlled candy accents.
  app: "#FCFBF8",
  canvas: "#FCFBF8",
  sidebar: "#F7F7F4",
  chat: "#FFFDF8",
  card: "#FFFDFB",
  inputBg: "#F0EFEC",
  border: "rgba(24,24,22,0.075)",
  borderStrong: "rgba(24,24,22,0.12)",
  ink: "#171716",
  ink2: "#3B3A37",
  ink3: "#706E68",
  ink4: "#B9B6AE",
  hover: "rgba(24,24,22,0.04)",
  active: "rgba(24,24,22,0.06)",
  accent: "#FFB43F",
  accentBlue: "#4285F4",
  accentPink: "#F073A7",
  accentPurple: "#8757D7",
  accentGreen: "#67CEC8",
  accentSoft: "#F1F0ED",
  shadowCard: "0 1px 1px rgba(24,24,22,0.045), 0 9px 22px rgba(24,24,22,0.03)",
  shadowLift: "0 10px 28px rgba(24,24,22,0.085)",
  shadowPane: "0 18px 45px rgba(24,24,22,0.075)",
  icon: "#585753",
};

const DARK: Theme = {
  app: "#161513",
  canvas: "#161513",
  sidebar: "#161513",
  chat: "#161513",
  card: "#221F1A",
  inputBg: "#2A2722",
  border: "rgba(255,252,245,0.08)",
  borderStrong: "rgba(255,252,245,0.16)",
  ink: "#F1EEE8",
  ink2: "#B7B3AA",
  ink3: "#857F76",
  ink4: "#615C54",
  hover: "rgba(255,252,245,0.055)",
  active: "rgba(255,252,245,0.10)",
  accent: "#F2A84E",
  accentBlue: "#5D9BFF",
  accentPink: "#F181B7",
  accentPurple: "#9B72E5",
  accentGreen: "#7ADBD7",
  accentSoft: "rgba(242,168,78,0.15)",
  shadowCard: "0 1px 2px rgba(0,0,0,0.3)",
  shadowLift: "0 8px 24px rgba(0,0,0,0.4)",
  shadowPane: "0 1px 3px rgba(0,0,0,0.35)",
  icon: "#8E8980",
};

/* Entity icons stay monochrome like Strut; color is reserved for tiny stage rings. */
type EntityType = "doc" | "sheet" | "deck" | "page";
const ENTITY: Record<
  EntityType,
  { Icon: typeof FileText; label: string }
> = {
  doc: { Icon: FileText, label: "Doc" },
  sheet: { Icon: Table2, label: "Sheet" },
  deck: { Icon: Presentation, label: "Deck" },
  page: { Icon: LayoutTemplate, label: "Page" },
};

/* ───────────────────────── mock data ───────────────────────── */

type Item = {
  id: string;
  type: EntityType;
  title: string;
  preview: string;
  meta: string;
  bucket: "today" | "yesterday" | "earlier";
};
type FolderT = { id: string; name: string; color: string; items: Item[] };
type ProjectT = {
  id: string;
  name: string;
  accent: string;
  initial: string;
  folders: FolderT[];
};

const PROJECTS: ProjectT[] = [
  {
    id: "icici",
    name: "Small Business Guide",
    accent: "#4285F4",
    initial: "S",
    folders: [
      {
        id: "design",
        name: "Ideas",
        color: "#4285F4",
        items: [
          { id: "dc1", type: "doc", title: "Hiring", preview: "When to hire\nFull-time vs freelance\nInterview tips\nOnboarding process\n\nRegular performance reviews can help identify areas for employee development.\n\nWhen to Hire: Hiring should be considered when the workload consistently exceeds your current team's capacity.", meta: "edited 9m ago", bucket: "today" },
          { id: "dc2", type: "doc", title: "Customer Service", preview: "Importance of CS\nTraining staff\nHandling complaints\nCustomer feedback\n\nA well-trained customer service team can significantly improve customer retention and build trust with first-time buyers.", meta: "edited 1h ago", bucket: "today" },
        ],
      },
      {
        id: "spec",
        name: "Research",
        color: "#8757D7",
        items: [
          { id: "pg1", type: "page", title: "Growth Strategies", preview: "Scaling vs expanding\nFranchising\nPartnerships\nDiversification\n\nScaling refers to increasing revenue without a significant rise in costs, aiming for efficiency and higher profit margins.", meta: "edited 22m ago", bucket: "today" },
          { id: "sh1", type: "sheet", title: "Sales Strategies", preview: "Cold calling vs inbound\nSales funnel basics\nCRM software\nCustomer retention\n\nUnderstanding your sales funnel can help you pinpoint where you're losing potential customers.", meta: "edited 2h ago", bucket: "yesterday" },
          { id: "pg2", type: "page", title: "Marketing", preview: "Digital vs traditional\nBudget considerations\nROI tracking\n\nConsider using Google Analytics to track the success of your SEO efforts and identify better audience segments.", meta: "edited 1d ago", bucket: "earlier" },
        ],
      },
      {
        id: "data",
        name: "Drafts",
        color: "#FFAD45",
        items: [
          { id: "dk1", type: "deck", title: "Role of Customer Service in Customer Retention", preview: "While various factors contribute to customer loyalty, one aspect that stands out is the quality of customer service. A well-trained support team is not just an asset.", meta: "edited 35m ago", bucket: "today" },
          { id: "dc3", type: "doc", title: "Crafting a Brand Identity", preview: "Your brand is the essence of your business. It's what sets you apart, tells your story, and connects you with your ideal customers.", meta: "edited 4h ago", bucket: "yesterday" },
        ],
      },
    ],
  },
];

const OTHER_PROJECTS = [
  { name: "Social Posts", initial: "S", accent: "#F073A7" },
  { name: "Research", initial: "R", accent: "#8757D7" },
  { name: "Dieter Rams", initial: "D", accent: "#9A8F86" },
  { name: "Video Scripts", initial: "V", accent: "#8AC7EA" },
  { name: "Series", initial: "S", accent: "#67CEC8" },
  { name: "Newsletter", initial: "N", accent: "#F7C853" },
  { name: "Archive", initial: "A", accent: "#9EA3AA" },
];

const KANBAN_STAGES = ["Backlog", "Drafting", "In Review", "Done"] as const;

/* ───────────────────────── page ───────────────────────── */

type ViewMode = "board" | "kanban" | "timeline";

export default function StrutPreview() {
  const [mode, setMode] = useState<Theme>(LIGHT);
  const dark = mode === DARK;
  const t = mode;

  const [view, setView] = useState<ViewMode>("board");
  const [chatOpen, setChatOpen] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    icici: true,
    design: true,
    spec: false,
    data: false,
  });

  const project = PROJECTS[0];
  const allItems = useMemo(
    () => project.folders.flatMap((f) => f.items.map((i) => ({ ...i, folder: f }))),
    [project],
  );
  const open = openId ? allItems.find((i) => i.id === openId) ?? null : null;

  const toggle = (id: string) =>
    setExpanded((e) => ({ ...e, [id]: !e[id] }));

  /* focus mode: editor only, no sidebar / chat */
  if (open && focus) {
    return (
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ background: t.canvas, color: t.ink, fontFamily: FONT }}
      >
        <button
          onClick={() => setFocus(false)}
          className="fixed top-5 left-5 z-50 flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] press"
          style={{ background: t.card, color: t.ink2, border: `1px solid ${t.border}`, boxShadow: t.shadowCard }}
        >
          <Maximize2 size={13} /> Exit focus
        </button>
        <EntityBody item={open} t={t} focus />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex text-[13px] overflow-hidden"
      style={{ background: t.app, color: t.ink, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}
    >
      {/* ───────── Sidebar ───────── */}
      <aside
        className="flex flex-col flex-shrink-0"
        style={{ width: 232, background: t.sidebar, borderRight: `1px solid ${t.border}` }}
      >
        {/* Brand mark */}
        <div className="flex items-center gap-2.5 px-8 h-[76px] flex-shrink-0">
          <LogoMark />
          <span className="text-[19px] font-semibold tracking-[-0.035em]" style={{ color: t.ink }}>Primy</span>
          <button
            onClick={() => setMode(dark ? LIGHT : DARK)}
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-[7px] press"
            style={{ color: t.icon }}
            title="Toggle theme"
          >
            {dark ? <Sun size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>

        <div className="px-8 pb-8">
          <NavRow t={t} icon={<Inbox size={16} />} label="Inbox" badge="3" />
          <NavRow t={t} icon={<PenLine size={16} />} label="Quick Note" />
          <NavRow t={t} icon={<Search size={16} />} label="Search" />
        </div>

        {/* projects + nested folders */}
        <div className="flex-1 overflow-y-auto px-6 pt-1 min-h-0">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[13px] font-medium" style={{ color: t.ink3 }}>
              Workspaces
            </span>
          </div>

          {/* active project — expandable into folders */}
          <Tree
            t={t}
            open={expanded[project.id]}
            onToggle={() => toggle(project.id)}
            leading={
              <WorkspaceDot color={project.accent} />
            }
            label={project.name}
            active
          />
          {expanded[project.id] && (
            <div className="mt-0.5">
              {project.folders.map((f) => (
                <div key={f.id}>
                  <Tree
                    t={t}
                    indent={1}
                    open={expanded[f.id]}
                    onToggle={() => toggle(f.id)}
                    leading={
                      expanded[f.id] ? (
                        <WorkspaceDot color={f.color} />
                      ) : (
                        <WorkspaceDot color={f.color} />
                      )
                    }
                    label={f.name}
                    count={f.items.length}
                  />
                  {expanded[f.id] &&
                    f.items.map((it) => {
                      const e = ENTITY[it.type];
                      return (
                        <Leaf
                          key={it.id}
                          t={t}
                          icon={<e.Icon size={14} style={{ color: t.icon }} />}
                          label={it.title}
                          active={openId === it.id}
                          onClick={() => { setOpenId(it.id); setFocus(false); }}
                        />
                      );
                    })}
                  {expanded[f.id] && (
                    <Leaf t={t} muted icon={<Plus size={14} />} label="New" onClick={() => {}} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* other projects */}
          <div className="mt-1">
            {OTHER_PROJECTS.map((p) => (
              <Tree
                key={p.name}
                t={t}
                leading={<WorkspaceDot color={p.accent} />}
                label={p.name}
                onToggle={() => {}}
              />
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="px-8 py-5 flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
          <NavRow t={t} icon={<AudioLines size={17} />} label="Voice & Tone" />
          <NavRow t={t} icon={<CircleHelp size={17} />} label="Help & Support" />
          <div className="mt-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-medium" style={{ background: "#E8D7FF", color: "#3A2B45" }}>D</div>
            <span className="text-[13.5px] font-medium flex-1" style={{ color: t.ink2 }}>Primy</span>
            <ChevronRight size={13} style={{ color: t.ink4, transform: "rotate(90deg)" }} />
          </div>
        </div>
      </aside>

      {/* ───────── Main column ───────── */}
      <div className="flex flex-1 min-w-0" style={{ background: t.canvas }}>
        <div className="flex flex-col flex-1 min-w-0">
          {/* topbar */}
          <header
            className="flex items-center gap-3 pl-8 pr-7 flex-shrink-0"
            style={{ height: 64 }}
          >
            {open ? (
              <button
                onClick={() => setOpenId(null)}
                className="flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-[8px] press text-[13px]"
                style={{ color: t.ink2 }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = t.hover)}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
              >
                <ArrowLeft size={15} /> {project.name}
              </button>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[15px] tracking-[-0.005em] truncate">{project.name}</span>
                <ChevronRight size={13} style={{ color: t.ink4, transform: "rotate(90deg)" }} />
              </div>
            )}

            <div className="flex-1" />

            <button
              className="h-8 px-2 rounded-[8px] text-[14px] press"
              style={{ color: t.ink3 }}
            >
              Share
            </button>

            {!open && (
              <div
                className="inline-flex items-center rounded-full p-1 mr-1"
                style={{ background: t.accentSoft }}
              >
                {([
                  ["board", LayoutGrid],
                  ["kanban", Columns3],
                  ["timeline", CalendarDays],
                  ["board", Rows3],
                ] as const).map(([m, Ic], idx) => {
                  // map the 4th (Rows3 = list) onto board too, just for visual parity
                  const isList = idx === 3;
                  const activeM = !isList && view === m;
                  return (
                    <button
                      key={idx}
                      onClick={() => !isList && setView(m)}
                      className="flex items-center justify-center w-8 h-8 rounded-full press"
                      style={{
                        background: activeM ? t.card : "transparent",
                        color: activeM ? t.accentBlue : t.icon,
                        boxShadow: activeM ? "0 1px 7px rgba(31,29,25,0.08)" : undefined,
                      }}
                    >
                      <Ic size={16} />
                    </button>
                  );
                })}
              </div>
            )}

            <ToolbarBtn t={t}><AudioLines size={16} /></ToolbarBtn>
            <ToolbarBtn t={t}><MoreHorizontal size={16} /></ToolbarBtn>
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-[8px] press"
              style={{ color: t.icon }}
              title={chatOpen ? "Collapse chat" : "Open chat"}
            >
              {chatOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </header>

          {/* body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {open ? (
              <OpenEntityShell item={open} t={t} onFocus={() => setFocus(true)} />
            ) : view === "board" ? (
              <BoardView project={project} t={t} onOpen={setOpenId} />
            ) : view === "kanban" ? (
              <KanbanView items={allItems} t={t} onOpen={setOpenId} />
            ) : (
              <TimelineView items={allItems} t={t} onOpen={setOpenId} />
            )}
          </div>
        </div>

        {/* ───────── Chat pane (docked, cream) ───────── */}
        {chatOpen && <ChatPane t={t} project={project} />}
      </div>
    </div>
  );
}

const FONT = "Inter, system-ui, sans-serif";

/* ───────────────────────── sidebar atoms ───────────────────────── */

function LogoMark() {
  return (
    <div className="relative w-[23px] h-[23px] flex-shrink-0" aria-hidden>
      <span className="absolute left-0 top-[5px] w-[7px] h-[13px] rounded-r-full bg-black" />
      <span className="absolute left-[7px] top-[2px] w-[5px] h-[19px] rounded-full bg-black rotate-[-28deg]" />
      <span className="absolute left-[13px] top-[3px] w-[5px] h-[17px] rounded-full bg-black rotate-[28deg]" />
      <span className="absolute right-0 top-[6px] w-[4px] h-[11px] rounded-full bg-black" />
    </div>
  );
}

function WorkspaceDot({ color }: { color: string }) {
  return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />;
}

function NavRow({
  t, icon, label, badge, hint,
}: { t: Theme; icon: React.ReactNode; label: string; badge?: string; hint?: string }) {
  return (
    <button
      className="flex items-center gap-3 w-full h-[36px] rounded-[10px] text-[13px] press"
      style={{ color: t.ink3 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = t.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: t.icon }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge && (
        <span className="text-[11px] font-medium w-5 h-5 rounded-full tabular-nums flex items-center justify-center" style={{ background: t.accentSoft, color: t.ink3 }}>
          {badge}
        </span>
      )}
      {hint && <span className="text-[11px] tabular-nums" style={{ color: t.ink4 }}>{hint}</span>}
    </button>
  );
}

function Tree({
  t, leading, label, open, onToggle, count, active, indent = 0,
}: {
  t: Theme; leading: React.ReactNode; label: string; open?: boolean;
  onToggle: () => void; count?: number; active?: boolean; indent?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full h-[35px] rounded-full text-[13px] press"
      style={{
        paddingLeft: 11 + indent * 12,
        paddingRight: 11,
        background: active ? t.active : "transparent",
        color: active ? t.ink : t.ink2,
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.hover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? t.active : "transparent"; }}
    >
      <ChevronRight
        size={0}
        style={{ display: "none" }}
      />
      {leading}
      <span className="flex-1 text-left truncate">{label}</span>
      {count != null && <span className="text-[11px] tabular-nums" style={{ color: t.ink4 }}>{count}</span>}
    </button>
  );
}

function Leaf({
  t, icon, label, active, muted, onClick,
}: { t: Theme; icon: React.ReactNode; label: string; active?: boolean; muted?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full h-[28px] rounded-full text-[12px] press"
      style={{
        paddingLeft: 34, paddingRight: 10,
        background: active ? t.active : "transparent",
        color: muted ? t.ink4 : active ? t.ink : t.ink2,
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.hover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? t.active : "transparent"; }}
    >
      <span className="flex-shrink-0" style={{ color: muted ? t.ink4 : t.icon }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

function Avatars({ t }: { t: Theme }) {
  return (
    <div className="flex -space-x-1.5 mx-1">
      {[["DE", "#1C1B19"], ["MC", "#6b6b6b"]].map(([n, bg]) => (
        <div
          key={n}
          className="flex items-center justify-center rounded-full text-white text-[9px] font-semibold"
          style={{ width: 24, height: 24, background: bg, boxShadow: `0 0 0 2px ${t.canvas}` }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── BOARD (folders as stages) ───────────────────────── */

function BoardView({ project, t, onOpen }: { project: ProjectT; t: Theme; onOpen: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div>
      {project.folders.map((f) => {
        const isCol = collapsed[f.id];
        return (
          <section key={f.id} style={{ borderTop: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-5 h-[76px] group px-8">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [f.id]: !c[f.id] }))}
                className="flex items-center gap-4 press"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: f.color }} />
                <span className="text-[15px] font-semibold tracking-[-0.005em]">{f.name}</span>
              </button>
              <span className="text-[12px] tabular-nums" style={{ color: t.ink4 }}>{f.items.length}</span>
              <div className="flex-1" />
              <button
                className="flex items-center justify-center w-6 h-6 rounded-[6px] press opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: t.icon }}
              >
                <Plus size={17} />
              </button>
            </div>
            {!isCol && (
              <div className="grid gap-4 px-9 pb-9 stagger-in" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))" }}>
                <NewCard t={t} />
                {f.items.map((it) => (
                  <Card key={it.id} item={it} t={t} tag={f.name} marker={f.color} onOpen={onOpen} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StageMarker({ color, dotted }: { color: string; dotted?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: 17,
        height: 17,
        border: dotted ? `3px dotted ${color}` : `2.5px solid ${color}`,
      }}
    />
  );
}

function Card({ item, t, tag, marker, onOpen }: { item: Item; t: Theme; tag: string; marker: string; onOpen: (id: string) => void }) {
  const lines = item.preview.split("\n").filter(Boolean);
  const bullets = lines.slice(0, 4);
  const body = lines.slice(4).join(" ");
  const chip = chipTone(marker);
  const e = ENTITY[item.type];
  return (
    <button
      onClick={() => onOpen(item.id)}
      className="text-left rounded-[12px] px-4 py-4 lift flex flex-col relative overflow-hidden group"
      style={{ background: t.card, border: `1px solid ${t.borderStrong}`, boxShadow: t.shadowCard, minHeight: 272 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-[16px] font-semibold tracking-[-0.02em] leading-snug flex-1" style={{ color: t.ink }}>{item.title}</div>
        <MoreHorizontal size={15} style={{ color: t.ink3 }} />
      </div>
      <EntityPreview item={item} t={t} bullets={bullets} body={body} />
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0 h-24"
        style={{ background: `linear-gradient(to bottom, transparent, ${t.card} 72%)` }}
      />
      <div className="flex items-center gap-3 mt-5 relative z-10">
        <StageMarker color={t.icon} dotted />
        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: t.ink3 }}>
          <e.Icon size={13} />
          {e.label}
        </span>
        <span
          className="ml-auto inline-flex items-center h-[22px] px-3 rounded-full text-[12px]"
          style={{ background: chip.bg, color: chip.text }}
        >
          {tag === "Ideas" ? item.title.split(" ")[0] : tag === "Drafts" ? (item.id === "dc3" ? "Branding" : "CS") : tag}
        </span>
      </div>
    </button>
  );
}

function EntityPreview({
  item,
  t,
  bullets,
  body,
}: {
  item: Item;
  t: Theme;
  bullets: string[];
  body: string;
}) {
  if (item.type === "sheet") {
    return (
      <div className="flex-1 rounded-[9px] overflow-hidden" style={{ border: `1px solid ${t.border}`, background: "#FCFBF8" }}>
        <div className="grid grid-cols-3 text-[10.5px] font-medium" style={{ color: t.ink3, background: "#F3F2EF" }}>
          {["Channel", "Cost", "ROI"].map((h) => <div key={h} className="px-2 py-1.5 border-r last:border-r-0" style={{ borderColor: t.border }}>{h}</div>)}
        </div>
        {[
          ["Inbound", "$4.2k", "2.8x"],
          ["CRM", "$1.1k", "1.9x"],
          ["Email", "$860", "3.4x"],
        ].map((row) => (
          <div key={row.join("")} className="grid grid-cols-3 text-[11px]" style={{ color: t.ink2, borderTop: `1px solid ${t.border}` }}>
            {row.map((c) => <div key={c} className="px-2 py-1.5 border-r last:border-r-0 truncate" style={{ borderColor: t.border }}>{c}</div>)}
          </div>
        ))}
      </div>
    );
  }

  if (item.type === "deck") {
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden relative" style={{ border: `1px solid ${t.border}`, background: "linear-gradient(135deg, #FFF4DE, #FFE0B7 48%, #9DD7FF)" }}>
        <div className="absolute left-4 top-4 text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(23,23,22,0.55)" }}>Deck</div>
        <div className="absolute left-4 top-10 text-[18px] font-semibold leading-tight max-w-[150px]" style={{ color: t.ink }}>Customer retention</div>
        <div className="absolute right-4 bottom-4 flex gap-1.5">
          {[1, 2, 3].map((n) => <span key={n} className="w-8 h-5 rounded-[4px] bg-white/70 border" style={{ borderColor: t.border }} />)}
        </div>
      </div>
    );
  }

  if (item.type === "page") {
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden" style={{ border: `1px solid ${t.border}`, background: "#FFFFFF" }}>
        <div className="h-10 px-3 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${t.border}`, background: "#F6F5F2" }}>
          <span className="w-2 h-2 rounded-full bg-[#FF7D6E]" />
          <span className="w-2 h-2 rounded-full bg-[#F7C853]" />
          <span className="w-2 h-2 rounded-full bg-[#67CEC8]" />
        </div>
        <div className="p-3">
          <div className="h-3 w-24 rounded-full mb-2" style={{ background: "#DDEBFF" }} />
          <div className="h-10 rounded-[7px] mb-2" style={{ background: "linear-gradient(90deg, #EAF4FF, #FFF4DE)" }} />
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((n) => <span key={n} className="h-8 rounded-[5px]" style={{ background: n === 1 ? "#F3ECFF" : "#F3F2EF" }} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="text-[12px] leading-[1.55] mb-5 pl-4 space-y-0.5" style={{ color: t.ink2, listStyle: "disc" }}>
        {bullets.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="text-[12px] leading-[1.45] line-clamp-[5] flex-1" style={{ color: t.ink2 }}>{body}</p>
    </>
  );
}

function chipTone(color: string) {
  if (color === "#4285F4") return { bg: "#EDF4FF", text: "#3F79E0" };
  if (color === "#8757D7") return { bg: "#F3ECFF", text: "#8051CC" };
  if (color === "#FFAD45") return { bg: "#FFF1DF", text: "#B87426" };
  return { bg: "#F1F0ED", text: "#706E68" };
}

function NewCard({ t }: { t: Theme }) {
  return (
    <button
      className="relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-[12px] press"
      style={{
        border: `1px solid ${t.borderStrong}`,
        color: t.ink,
        minHeight: 272,
        background: "linear-gradient(145deg, #FFFDFB 0%, #EEF7FF 100%)",
      }}
    >
      <span className="flex items-center justify-center w-16 h-16 rounded-full bg-white/78 backdrop-blur-sm shadow-[0_18px_45px_rgba(22,22,20,0.08)]">
        <Plus size={29} strokeWidth={1.8} />
      </span>
      <span className="text-[15px] font-medium">Create</span>
      <span className="text-[12px]" style={{ color: t.ink3 }}>New doc</span>
    </button>
  );
}

/* ───────────────────────── KANBAN ───────────────────────── */

function KanbanView({ items, t, onOpen }: { items: (Item & { folder: FolderT })[]; t: Theme; onOpen: (id: string) => void }) {
  // distribute mock items across stages deterministically
  const columns = KANBAN_STAGES.map((stage, si) => ({
    stage,
    items: items.filter((_, i) => i % KANBAN_STAGES.length === si),
  }));
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-8 py-8">
      <div className="grid gap-5 h-full" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {columns.map((c, i) => (
          <div key={c.stage} className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ["#8757D7", "#4285F4", "#FFAD45", "#67CEC8"][i] }} />
              <span className="text-[13px] font-semibold">{c.stage}</span>
              <span className="text-[11.5px] tabular-nums" style={{ color: t.ink4 }}>{c.items.length}</span>
              <div className="flex-1" />
              <Plus size={14} style={{ color: t.ink4 }} />
            </div>
            <div className="flex flex-col gap-2.5">
              {c.items.map((it) => {
                const e = ENTITY[it.type];
                return (
                  <button
                    key={it.id}
                    onClick={() => onOpen(it.id)}
                    className="text-left rounded-[10px] p-3 lift min-w-0"
                    style={{ background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadowCard }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <e.Icon size={12} style={{ color: t.icon }} />
                      <span className="text-[10.5px]" style={{ color: t.ink3 }}>{e.label}</span>
                    </div>
                    <div className="text-[13px] font-semibold tracking-[-0.01em] mb-1 line-clamp-2" style={{ color: t.ink }}>{it.title}</div>
                    <MiniTypePreview item={it} t={t} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniTypePreview({ item, t }: { item: Item; t: Theme }) {
  if (item.type === "sheet") {
    return (
      <div className="grid grid-cols-3 gap-px rounded-[6px] overflow-hidden text-[9px]" style={{ background: t.border, color: t.ink3 }}>
        {["A", "B", "C", "$", "2.8x", "34%"].map((cell) => (
          <span key={cell} className="px-1.5 py-1 truncate" style={{ background: "#F7F6F3" }}>{cell}</span>
        ))}
      </div>
    );
  }
  if (item.type === "deck") {
    return <div className="h-14 rounded-[7px]" style={{ background: "linear-gradient(135deg, #FFF4DE, #FFBE70 52%, #8AC7EA)" }} />;
  }
  if (item.type === "page") {
    return (
      <div className="rounded-[7px] overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
        <div className="h-4" style={{ background: "#F3F2EF" }} />
        <div className="p-1.5 space-y-1">
          <div className="h-2 rounded-full w-2/3" style={{ background: "#DDEBFF" }} />
          <div className="h-6 rounded" style={{ background: "linear-gradient(90deg, #F3ECFF, #EEF7FF)" }} />
        </div>
      </div>
    );
  }
  return <p className="text-[11.5px] leading-[1.5] line-clamp-3" style={{ color: t.ink3 }}>{item.preview.replace(/\n/g, " ")}</p>;
}

/* ───────────────────────── TIMELINE ───────────────────────── */

function TimelineView({ items, t, onOpen }: { items: (Item & { folder: FolderT })[]; t: Theme; onOpen: (id: string) => void }) {
  const buckets: { key: Item["bucket"]; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "earlier", label: "Earlier this week" },
  ];
  return (
    <div className="max-w-[1100px] mx-auto px-9 py-8">
      {buckets.map((b) => {
        const list = items.filter((i) => i.bucket === b.key);
        if (!list.length) return null;
        return (
          <section key={b.key} className="mb-9">
            <div className="flex items-center gap-3 mb-3.5">
              <span className="text-[13px] font-semibold" style={{ color: t.ink }}>{b.label}</span>
              <div className="flex-1 h-px" style={{ background: t.border }} />
            </div>
            <div className="grid gap-3.5 stagger-in" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))" }}>
              {list.map((it) => <Card key={it.id} item={it} t={t} tag={it.folder.name} marker={it.folder.color} onOpen={onOpen} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ───────────────────────── UNIFIED EDITOR SHELL ───────────────────────── */

function OpenEntityShell({ item, t, onFocus }: { item: Item; t: Theme; onFocus: () => void }) {
  const e = ENTITY[item.type];
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* one shell toolbar for EVERY entity type */}
      <div
        className="flex items-center gap-2 px-5 flex-shrink-0"
        style={{ height: 44, borderBottom: `1px solid ${t.border}` }}
      >
        <e.Icon size={14} style={{ color: t.icon }} />
        <span className="text-[13px] font-medium" style={{ color: t.ink }}>{item.title}</span>
        <span className="text-[11.5px] flex items-center gap-1" style={{ color: t.ink4 }}>
          <Check size={12} /> Saved
        </span>
        <div className="flex-1" />
        <ToolbarBtn t={t}><Type size={14} /></ToolbarBtn>
        <button
          onClick={onFocus}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[12px] press"
          style={{ color: t.ink2 }}
          onMouseEnter={(ev) => (ev.currentTarget.style.background = t.hover)}
          onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
        >
          <Maximize2 size={13} /> Focus
        </button>
        <ToolbarBtn t={t}><MoreHorizontal size={15} /></ToolbarBtn>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EntityBody item={item} t={t} />
      </div>
    </div>
  );
}

function ToolbarBtn({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <button
      className="flex items-center justify-center w-7 h-7 rounded-[7px] press"
      style={{ color: t.ink3 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = t.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

/* type-specific body, identical typography + rhythm across all four */
function EntityBody({ item, t, focus }: { item: Item; t: Theme; focus?: boolean }) {
  const wrap = focus ? "max-w-[680px] mx-auto px-8 py-16" : "max-w-[720px] mx-auto px-10 py-10";

  if (item.type === "doc") {
    return (
      <article className={wrap} style={{ color: t.ink }}>
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] leading-tight mb-2">{item.title}</h1>
        <p className="text-[13px] mb-8" style={{ color: t.ink4 }}>Draft · {item.meta}</p>
        <DocProse t={t} />
      </article>
    );
  }
  if (item.type === "sheet") {
    return (
      <div className={wrap.replace("max-w-[720px]", "max-w-[860px]").replace("max-w-[680px]", "max-w-[760px]")}>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] mb-5" style={{ color: t.ink }}>{item.title}</h1>
        <NativeSheet t={t} />
      </div>
    );
  }
  if (item.type === "deck") {
    return (
      <div className={wrap.replace("max-w-[720px]", "max-w-[900px]").replace("max-w-[680px]", "max-w-[760px]")}>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] mb-5" style={{ color: t.ink }}>{item.title}</h1>
        <NativeDeck t={t} />
      </div>
    );
  }
  // page
  return (
    <div className={wrap.replace("max-w-[720px]", "max-w-[760px]")}>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] mb-5" style={{ color: t.ink }}>{item.title}</h1>
      <NativePage t={t} />
    </div>
  );
}

function DocProse({ t }: { t: Theme }) {
  return (
    <div className="text-[15.5px] leading-[1.75]" style={{ color: t.ink2 }}>
      <p className="mb-5">
        In a competitive market, standing out isn&apos;t just about having the best product or
        service. It&apos;s about creating a memorable brand experience — a through-line that
        carries from the first touch to the thousandth.
      </p>
      <h2 className="text-[19px] font-semibold tracking-[-0.015em] mt-9 mb-3" style={{ color: t.ink }}>Define your brand core</h2>
      <p className="mb-5">
        At the heart of your brand identity lies your mission and values. These aren&apos;t
        words on a slide — they&apos;re the rules that decide what the brand says yes and no to.
      </p>
      <h2 className="text-[19px] font-semibold tracking-[-0.015em] mt-9 mb-3" style={{ color: t.ink }}>Visual identity</h2>
      <p className="mb-5">
        Your logo and color scheme are more than just visuals. They&apos;re the face of your
        brand and should be consistent across every platform — a quiet confidence that builds
        rapport with your audience.
      </p>
      <ul className="mb-5 space-y-2 pl-5" style={{ listStyle: "disc" }}>
        <li>Warmth over polish — human first, enterprise second.</li>
        <li>One accent, used with restraint.</li>
        <li>Type that breathes; generous line height.</li>
      </ul>
    </div>
  );
}

function NativeSheet({ t }: { t: Theme }) {
  const cols = ["Line item", "Q1", "Q2", "Q3", "Total"];
  const rows = [
    ["Media", "$8,000", "$12,000", "$18,000", "$38,000"],
    ["Production", "$4,500", "$3,000", "$6,500", "$14,000"],
    ["Contingency", "$1,000", "$1,000", "$2,000", "$4,000"],
    ["Tooling", "$2,000", "$2,000", "$2,000", "$6,000"],
  ];
  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: `1px solid ${t.border}`, boxShadow: t.shadowCard }}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={c}
                className="text-left font-medium px-3.5 py-2.5"
                style={{ color: t.ink3, background: t.hover, borderBottom: `1px solid ${t.border}`, borderRight: i < cols.length - 1 ? `1px solid ${t.border}` : undefined }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3.5 py-2.5 ${ci === 0 ? "font-medium" : "tabular-nums"}`}
                  style={{
                    color: ci === 0 ? t.ink : t.ink2,
                    borderBottom: ri < rows.length - 1 ? `1px solid ${t.border}` : undefined,
                    borderRight: ci < cols.length - 1 ? `1px solid ${t.border}` : undefined,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="px-3.5 py-2.5 font-semibold" style={{ color: t.ink, background: t.hover }}>Total</td>
            {["$15,500", "$18,000", "$28,500", "$62,000"].map((v, i) => (
              <td key={i} className="px-3.5 py-2.5 font-semibold tabular-nums" style={{ color: t.ink, background: t.hover, borderRight: i < 3 ? `1px solid ${t.border}` : undefined }}>{v}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NativeDeck({ t }: { t: Theme }) {
  return (
    <div>
      <div
        className="rounded-[12px] aspect-[16/9] flex flex-col justify-center px-12 text-white relative overflow-hidden mb-4"
        style={{ background: `linear-gradient(135deg, ${t.accent} 0%, #C9572A 100%)` }}
      >
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-90">ICICI Rebrand</div>
        <div className="text-[34px] font-bold tracking-[-0.025em] mt-2 leading-[1.05]">The approachable expert.</div>
        <div className="text-[15px] opacity-90 mt-2">Sharp. Warm. Human. — the identity, in one line.</div>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
      </div>
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="flex-1 rounded-[8px] aspect-[16/9] flex items-center justify-center text-[11px]"
            style={{ background: t.card, border: `1px solid ${n === 1 ? t.accent : t.border}`, color: t.ink4 }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function NativePage({ t }: { t: Theme }) {
  return (
    <div className="rounded-[12px] overflow-hidden" style={{ border: `1px solid ${t.border}`, boxShadow: t.shadowCard }}>
      <div className="px-10 py-12 text-center" style={{ background: t.accentSoft }}>
        <div className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: t.ink }}>Meet the new ICICI.</div>
        <div className="text-[14px] mt-2" style={{ color: t.ink2 }}>Banking that feels human again.</div>
        <button className="mt-5 h-9 px-5 rounded-full text-white text-[13px] font-medium" style={{ background: t.accent }}>Get started</button>
      </div>
      <div className="grid grid-cols-3 gap-3 p-6" style={{ background: t.canvas }}>
        {["Fast", "Warm", "Clear"].map((h) => (
          <div key={h} className="rounded-[8px] p-4" style={{ border: `1px solid ${t.border}` }}>
            <div className="text-[14px] font-semibold" style={{ color: t.ink }}>{h}</div>
            <div className="text-[12px] mt-1 leading-snug" style={{ color: t.ink3 }}>A short supporting line that sells the point.</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── CHAT PANE ───────────────────────── */

function ChatPane({ t, project }: { t: Theme; project: ProjectT }) {
  return (
    <section
      className="flex flex-col flex-shrink-0 m-5 ml-3 rounded-[12px] overflow-hidden"
      style={{ width: 430, background: t.chat, border: `1px solid ${t.borderStrong}`, boxShadow: t.shadowPane }}
    >
      <div className="flex items-center gap-2 px-7 h-[58px] flex-shrink-0">
        <LogoMark />
        <span className="font-semibold text-[16px] tracking-[-0.02em]">Primy</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: t.accentSoft, color: t.ink3 }}>Beta</span>
        <div className="flex-1" />
        <ToolbarBtn t={t}><Maximize2 size={14} /></ToolbarBtn>
        <ToolbarBtn t={t}><PanelRightClose size={15} /></ToolbarBtn>
      </div>

      <HeroLandscape t={t} />

      <div className="flex-1 overflow-y-auto px-8 pb-7 flex flex-col justify-end">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: t.accent }} />
          <div className="font-semibold text-[18px] tracking-[-0.015em]">Primy</div>
        </div>
        <div className="text-[16px] leading-[1.48] space-y-5" style={{ color: t.ink }}>
          <p>Hi there!</p>
          <p>
            You can use the left workspace to start creating and organizing your work. Anything
            you create, we can chat about here.
          </p>
          <p style={{ color: t.ink2 }}>
            Or, ask me to draft, summarize, or turn one file into another. I&apos;ve
            got the full context for <span className="font-medium" style={{ color: t.ink }}>{project.name}</span>, and
            you can drag in any file.
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 flex-shrink-0">
        <div
          className="flex items-center gap-2 rounded-full pl-5 pr-2"
          style={{ background: t.inputBg, height: 50, boxShadow: "inset 0 0 0 1px rgba(22,22,20,0.035)" }}
        >
          <span className="flex-1 text-[14px] truncate" style={{ color: t.ink3 }}>
            Ask anything...
          </span>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 press"
            style={{ background: "rgba(31,29,25,0.08)", color: t.icon }}
          >
            <ArrowUp size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroLandscape({ t }: { t: Theme }) {
  return (
    <div className="relative h-[190px] overflow-hidden flex-shrink-0" style={{ background: "#FFFDF7" }} aria-hidden>
      <div className="absolute inset-0 opacity-95" style={{ background: "radial-gradient(circle at 34% 12%, rgba(255,255,255,0.98), transparent 42%), linear-gradient(180deg, #fffef9 0%, #fff8ee 100%)" }} />
      <div className="absolute left-[-44px] bottom-[-70px] w-[245px] h-[170px] rounded-[55%_45%_0_0]" style={{ background: "linear-gradient(120deg, #5BA1F4 4%, #2E7DDB 45%, #39C4A0 100%)", filter: "blur(.1px)" }} />
      <div className="absolute right-[-16px] bottom-[30px] w-[310px] h-[84px] rounded-[100%_0_0_0]" style={{ background: "linear-gradient(100deg, rgba(244,124,181,0.70), rgba(255,203,54,0.88) 50%, rgba(255,122,69,0.82))", transform: "skewY(-11deg)" }} />
      <div className="absolute right-[-30px] bottom-[-52px] w-[340px] h-[125px] rounded-[70%_0_0_0]" style={{ background: "linear-gradient(105deg, #75E0BE, #2EA3DF 57%, #2F72C7)" }} />
      <div className="absolute left-[132px] bottom-[-11px] w-[190px] h-[68px] rounded-[50%] bg-[#FFF8C7] rotate-[-20deg]" />
      <div className="absolute left-[52px] bottom-[47px] w-[2px] h-[66px] bg-black" />
      <div className="absolute left-[22px] bottom-[104px] w-[64px] h-[64px] rounded-full border-t-[2px] border-l-[2px] border-black rotate-[18deg]" />
      <div className="absolute left-[53px] bottom-[102px] w-[42px] h-[42px] rounded-full border-t-[2px] border-r-[2px] border-black rotate-[-35deg]" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full bg-black"
          style={{ width: 8 - i, height: 8 - i, right: 72 - i * 22, bottom: 72 + i * 4 }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-10" style={{ background: `linear-gradient(to bottom, transparent, ${t.chat})` }} />
    </div>
  );
}
