"use client";

/**
 * TopBar — store-wired port of the approved /preview/topbar header.
 *
 * Sits transparently on the warm canvas (NOT a white bar). Layout:
 *   [ logo + Breadcrumb ]  ·····  [ Saved + Undo/Redo (file only) · Brain · Share · Avatar ]
 *
 * Wiring:
 * - Save-state indicator reads store isSaving / saveError / lastSavedAt and
 *   swaps glyphs with the `.icon-swap` / `.success-pop` motion (with safe
 *   inline fallbacks). Shown only when a file is open.
 * - Undo / Redo call store undo()/redo(), disabled via canUndo/canRedo.
 * - Brain (shown inside a project) opens a read-only right slide-over
 *   (BrainPanel) over the project's context: purpose/goal/audience/voice +
 *   projectMemory + file counts. Uses `.panel-reveal` motion.
 * - Share opens the existing project-mode ShareModal (same pattern as NavRail).
 * - Avatar reuses the NavRail profile menu pattern (Settings + Sign out).
 *
 * Root carries `data-top-bar` for present-mode focus hiding.
 */

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Brain,
  Share2,
  Undo2,
  Redo2,
  Cloud,
  CloudOff,
  Loader2,
  Check,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ENTITY_META } from "@/lib/entityMeta";
import { Breadcrumb, goGlobalHome } from "@/components/shell/Breadcrumb";
import { ShareModal } from "@/components/settings/ShareModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const HEAT = "#ff4a00";

export function TopBar() {
  const { data: session } = useSession();

  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  // Select only the primitives we render — NOT the whole `projects` array,
  // which changes reference on every debounced autosave and would re-render
  // the entire top bar on each keystroke-driven save.
  const projectTitle = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId)?.title ?? null);
  const projectShareToken = useAppStore((s) => s.projects.find((p) => p.id === s.currentProjectId)?.shareToken ?? null);
  const isSaving = useAppStore((s) => s.isSaving);
  const saveError = useAppStore((s) => s.saveError);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);

  const inProjectScope = !!currentProjectId;
  const inFile = !!currentEntityId;

  const [brainOpen, setBrainOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(projectShareToken);

  // Keep the local share token in sync with the active project.
  useEffect(() => {
    setShareToken(projectShareToken);
  }, [projectShareToken]);

  // Close the Brain panel if we leave the project scope.
  useEffect(() => {
    if (!inProjectScope) setBrainOpen(false);
  }, [inProjectScope]);

  const initials = session?.user?.name ? getInitials(session.user.name) : "U";

  return (
    <>
      <header
        data-top-bar
        className="flex items-center gap-2.5 pr-3 flex-shrink-0 relative z-40"
        style={{ height: 56 }}
      >
        {/* Logo — vertically aligned over the sidebar icon column
            (row pad-left 10 + sidebar 52/2 = 36; logo 30 wide → margin-left 21). */}
        <button
          onClick={goGlobalHome}
          title="Projects — all your projects"
          aria-label="Projects"
          className="press flex items-center justify-center rounded-[9px] text-white font-bold flex-shrink-0 active:scale-[0.97] transition-transform motion-reduce:transition-none"
          style={{ width: 30, height: 30, marginLeft: 21, background: HEAT, fontSize: 15, transitionDuration: "140ms", transitionTimingFunction: "var(--ease-out, cubic-bezier(0.23,1,0.32,1))" }}
        >
          D
        </button>

        {/* Left — breadcrumb (logo removed; it lives above ↑) */}
        <Breadcrumb />

        {inFile && <SaveIndicator isSaving={isSaving} saveError={saveError} lastSavedAt={lastSavedAt} />}

        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-1">
          {inFile && (
            <>
              <IconGhost title="Undo" disabled={!canUndo} onClick={undo}>
                <Undo2 size={15} />
              </IconGhost>
              <IconGhost title="Redo" disabled={!canRedo} onClick={redo}>
                <Redo2 size={15} />
              </IconGhost>
              <div className="w-px h-5 mx-1" style={{ background: "rgba(0,0,0,0.1)" }} />
            </>
          )}

          {inProjectScope && (
            <button
              onClick={() => setBrainOpen(true)}
              title="Project Brain — what Drafta knows about this project"
              className="press flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] text-[12.5px] font-medium text-[#525252] hover:bg-black/[0.05] active:scale-[0.97] transition-[background-color,transform] motion-reduce:transition-none"
              style={{ transitionDuration: "140ms" }}
            >
              <Brain size={14} className="text-[#9061ff]" />
              Brain
            </button>
          )}

          {inProjectScope && (
            <button
              onClick={() => setShareOpen(true)}
              title="Share project"
              className="press flex items-center gap-1.5 h-[30px] px-3 rounded-[8px] text-[12.5px] font-medium text-white active:scale-[0.97] transition-transform motion-reduce:transition-none"
              style={{ background: HEAT, transitionDuration: "140ms" }}
            >
              <Share2 size={13} />
              Share
            </button>
          )}

          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label="Profile menu"
                className={cn(
                  "press flex items-center justify-center rounded-full text-white text-[11px] font-semibold ml-1 overflow-hidden active:scale-[0.97] transition-transform motion-reduce:transition-none",
                  profileOpen && "ring-2 ring-[#b0ada6]/40 ring-offset-1"
                )}
                style={{ width: 28, height: 28, background: "#1a1a1a", transitionDuration: "140ms" }}
              >
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={10}
              className="menu-pop w-[200px] p-1.5 rounded-xl border border-[#e8e7e4]"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
                <div className="flex items-center justify-center rounded-full bg-[#e8e6e0] flex-shrink-0" style={{ width: 32, height: 32 }}>
                  <span className="text-[#5a5852] text-[11px]" style={{ fontWeight: 600 }}>{initials}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-[#2d2e2e] truncate" style={{ fontWeight: 550 }}>{session?.user?.name || "User"}</div>
                  <div className="text-[11px] text-[#9a968f] truncate">{session?.user?.email || ""}</div>
                </div>
              </div>
              <div className="h-px bg-[#f0eee9] mx-1 mb-1" />
              <button
                onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] hover:bg-[#f5f4f1] transition-colors text-left active:scale-[0.99]"
              >
                <Settings className="w-3.5 h-3.5 text-[#9a968f]" strokeWidth={1.75} />
                Settings
              </button>
              <div className="h-px bg-[#f0eee9] mx-1 my-1" />
              <button
                onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/login" }); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#d4183d] hover:bg-red-50 transition-colors text-left active:scale-[0.99]"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                Sign out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Brain slide-over */}
      {currentProjectId && <BrainPanel open={brainOpen} onClose={() => setBrainOpen(false)} projectId={currentProjectId} />}

      {/* Settings */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Share (project mode) */}
      {currentProjectId && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          mode="project"
          entityId={currentProjectId}
          entityTitle={projectTitle || "Project"}
          currentToken={shareToken}
          onTokenChange={(token) => {
            setShareToken(token);
            const state = useAppStore.getState();
            useAppStore.setState({
              projects: state.projects.map((p) => (p.id === currentProjectId ? { ...p, shareToken: token } : p)),
            });
          }}
        />
      )}
    </>
  );
}

/* ───────── Save-state indicator (icon-swap + success-pop) ───────── */
function SaveIndicator({
  isSaving,
  saveError,
  lastSavedAt,
}: {
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: number;
}) {
  // error > saving > saved
  if (saveError) {
    return (
      <div className="icon-swap flex items-center gap-1.5 ml-1.5 text-[#d4183d] motion-safe:animate-[topbarShake_320ms_ease]" title={saveError}>
        <CloudOff size={13} />
        <span className="text-[11.5px]">Save failed</span>
        <style jsx global>{`
          @keyframes topbarShake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-3px); }
            40%, 80% { transform: translateX(3px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .icon-swap { animation: none !important; }
          }
        `}</style>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="icon-swap flex items-center gap-1.5 ml-1.5 text-[#9a968f]">
        <Loader2 size={13} className="motion-safe:animate-spin" />
        <span className="text-[11.5px]">Saving…</span>
      </div>
    );
  }

  return (
    <div className="success-pop flex items-center gap-1.5 ml-1.5 text-[#9a968f]" title={lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Saved"}>
      <span className="relative inline-flex items-center justify-center" style={{ width: 14, height: 14 }}>
        <Cloud size={13} />
        <Check size={8} strokeWidth={3} className="absolute" style={{ color: "#2e9e47" }} />
      </span>
      <span className="text-[11.5px]">Saved</span>
    </div>
  );
}

/* ───────── Brain slide-over (read-only project context) ───────── */
function BrainPanel({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const projects = useAppStore((s) => s.projects);
  const projectMemory = useAppStore((s) => s.projectMemory);
  const project = projects.find((p) => p.id === projectId) || null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !project) return null;

  // Spec mapping: purpose=description, goal=goals, audience=audience, voice=tone.
  const context: { label: string; value: string }[] = [];
  if (project.description) context.push({ label: "Purpose", value: project.description });
  if (projectMemory.goals) context.push({ label: "Goal", value: projectMemory.goals });
  if (projectMemory.audience) context.push({ label: "Audience", value: projectMemory.audience });
  if (projectMemory.tone) context.push({ label: "Voice", value: projectMemory.tone });
  if (projectMemory.customInstructions) context.push({ label: "Instructions", value: projectMemory.customInstructions });

  const counts = [
    { label: ENTITY_META.ku.group, n: project.knowledgeUnits.length, color: ENTITY_META.ku.color, Icon: ENTITY_META.ku.Icon },
    { label: ENTITY_META.table.group, n: project.tables.length, color: ENTITY_META.table.color, Icon: ENTITY_META.table.Icon },
    { label: ENTITY_META.deck.group, n: (project.decks || []).length, color: ENTITY_META.deck.color, Icon: ENTITY_META.deck.Icon },
    { label: ENTITY_META.page.group, n: (project.pages || []).length, color: ENTITY_META.page.color, Icon: ENTITY_META.page.Icon },
  ];

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Project Brain">
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/20 motion-safe:animate-[brainFade_180ms_ease-out]" onClick={onClose} />

      {/* Panel */}
      <aside
        className="panel-reveal absolute top-0 right-0 h-full w-[min(380px,90vw)] bg-white flex flex-col motion-safe:animate-[brainSlide_240ms_var(--ease-drawer,cubic-bezier(0.32,0.72,0,1))]"
        style={{ boxShadow: "-12px 0 40px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 flex-shrink-0" style={{ height: 56, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <Brain size={16} className="text-[#9061ff]" />
          <span className="text-[14px] font-semibold tracking-[-0.01em] flex-1 truncate">Project Brain</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press flex items-center justify-center rounded-md text-[#9a968f] hover:bg-black/[0.05] active:scale-[0.97] transition-[background-color,transform] motion-reduce:transition-none"
            style={{ width: 28, height: 28, transitionDuration: "140ms" }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[12.5px] text-[#737373] leading-relaxed">
            What Drafta knows about <b className="font-medium text-[#171717]">{project.title}</b>.
          </div>

          {/* Context */}
          {context.length > 0 ? (
            <div className="mt-4 space-y-3">
              {context.map((c) => (
                <div key={c.label}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{c.label}</div>
                  <p className="text-[13px] text-[#3d3d3d] mt-1 leading-snug whitespace-pre-wrap">{c.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl px-3.5 py-3 text-[12.5px] text-[#737373]" style={{ background: "#faf9f7", border: "1px solid rgba(0,0,0,0.05)" }}>
              No project context yet. Chat with Drafta and it will learn the purpose, audience, and voice over time.
            </div>
          )}

          {/* Files */}
          <div className="mt-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a3a3] mb-2">Files</div>
            <div className="grid grid-cols-2 gap-2">
              {counts.map(({ label, n, color, Icon }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                  <Icon size={15} style={{ color, opacity: 0.85 }} />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold tabular-nums leading-none">{n}</div>
                    <div className="text-[11px] text-[#a3a3a3] mt-0.5">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        @keyframes brainSlide {
          from { transform: translateX(16px); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes brainFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .panel-reveal { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ───────── Ghost icon button (undo/redo) ───────── */
function IconGhost({
  children,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press flex items-center justify-center rounded-[8px] transition-[background-color,transform] motion-reduce:transition-none",
        disabled
          ? "text-[#cfccc6] cursor-default"
          : "text-[#737373] hover:bg-black/[0.05] active:scale-[0.97] cursor-pointer"
      )}
      style={{ width: 30, height: 30, transitionDuration: "140ms" }}
    >
      {children}
    </button>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
