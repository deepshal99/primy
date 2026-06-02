"use client";

/**
 * GlobalHome — the "Home = all projects" work-pane view.
 *
 * Shown in the floating work pane when no project is open (global home level).
 * Ports the approved preview's GlobalHomeView (src/app/preview/topbar/page.tsx)
 * and wires it to the real Zustand store: it lists real `projects`, computes
 * file counts from `project.counts` (or the loaded entity arrays), derives a
 * stable accent + initial per project, and switches projects on card click.
 *
 * "Recent activity" is derived from real project `updatedAt` timestamps — no
 * invented API. It is omitted gracefully when there are no projects.
 *
 * Motion: cards use .pop-in + .stagger-in (entrance) + .lift (hover), all
 * defined in src/styles/motion.css and reduced-motion safe. Local @keyframes
 * fallbacks are included so the entrance still works if motion.css is absent.
 */

import { useMemo, useState } from "react";
import { Plus, FolderPlus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { EmptyState as SharedEmptyState } from "@/components/ui/EmptyState";
import { AnimatedNumber, TextReveal } from "@/components/ui/transitions";
import type { Project } from "@/lib/types";

const HEAT = "var(--primary)";
const BORDER = "var(--border)";

// Stable per-project accent palette (entity + brand colors from design.ts).
const ACCENTS = ["#FFB43F", "#2a6dfb", "#9061ff", "#42c366", "#ecb730", "#eb3424"] as const;

/** Deterministic accent for a project id — stable across renders/sessions. */
function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

/** First meaningful letter of a title, uppercased; falls back to "•". */
function initialFor(title: string): string {
  const ch = title.trim().charAt(0);
  return ch ? ch.toUpperCase() : "•";
}

/** Total file count from lightweight `counts` or the loaded entity arrays. */
function fileCountFor(p: Project): number {
  if (p.counts) {
    return p.counts.knowledgeUnits + p.counts.tables + p.counts.decks + p.counts.pages;
  }
  return (
    (p.knowledgeUnits?.length ?? 0) +
    (p.tables?.length ?? 0) +
    (p.decks?.length ?? 0) +
    (p.pages?.length ?? 0)
  );
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function GlobalHome() {
  const projects = useAppStore((s) => s.projects);
  const switchProject = useAppStore((s) => s.switchProject);
  const createProject = useAppStore((s) => s.createProject);

  // Lock once a navigation starts so a rapid second click can't mis-fire before
  // the view swaps to the project (guards ISSUE-002 — interaction during load).
  const [busy, setBusy] = useState(false);
  const openProject = (id: string) => {
    if (busy) return;
    setBusy(true);
    switchProject(id);
    // switchProject is a no-op if the project is missing (deleted/stale id) —
    // the view stays on GlobalHome, so release the lock or the grid freezes.
    if (!useAppStore.getState().currentProjectId) setBusy(false);
  };
  const handleNew = () => {
    if (busy) return;
    setBusy(true);
    createProject("Untitled project");
  };

  // Recent activity from real data: most-recently-updated projects.
  const recent = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, 4),
    [projects]
  );

  const isEmpty = projects.length === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Local entrance/hover fallbacks — composed with motion.css when present. */}
      <style jsx>{`
        @keyframes gh-pop-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .gh-card {
          opacity: 1;
          animation: gh-pop-in 240ms cubic-bezier(0.23, 1, 0.32, 1) both;
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
            box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);
          will-change: transform, opacity;
        }
        @media (hover: hover) and (pointer: fine) {
          .gh-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
          }
        }
        .gh-card:active {
          transform: scale(0.99);
        }
        @media (prefers-reduced-motion: reduce) {
          .gh-card {
            animation: none;
          }
          .gh-card:hover {
            transform: none;
          }
          .gh-card:active {
            transform: none;
          }
        }
      `}</style>

      <div className="max-w-[900px] mx-auto px-12 py-9">
        <div className="flex items-start justify-between gap-4 mb-6">
          <TextReveal>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Projects</h1>
            <p className="text-[14px] text-muted-foreground mt-1">
              Pick up where you left off, or start something new.
            </p>
          </TextReveal>
          <button
            onClick={handleNew}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-medium text-primary-foreground transition-transform active:scale-[0.97] motion-reduce:transition-none flex-shrink-0 disabled:opacity-60"
            style={{ background: HEAT }}
          >
            <Plus size={14} /> New project
          </button>
        </div>

        {isEmpty ? (
          <EmptyState onCreate={handleNew} />
        ) : (
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${busy ? "pointer-events-none opacity-70" : ""}`}>
            {projects.map((p, i) => {
              const accent = accentFor(p.id);
              const count = fileCountFor(p);
              return (
                <div
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openProject(p.id);
                    }
                  }}
                  className="gh-card rounded-2xl bg-card p-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FFB43F]/40"
                  style={{
                    border: `1px solid ${BORDER}`,
                    boxShadow: "var(--shadow-card)",
                    // Stagger fallback (composes with .stagger-in from motion.css).
                    animationDelay: `${Math.min(i, 8) * 40}ms`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center rounded-xl text-white font-semibold flex-shrink-0"
                      style={{ width: 38, height: 38, background: accent, fontSize: 16 }}
                    >
                      {initialFor(p.title)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold tracking-[-0.01em] truncate">
                          {p.title || "Untitled project"}
                        </h3>
                        {p.projectType && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                          >
                            {p.projectType}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-[12.5px] text-muted-foreground mt-1 leading-snug line-clamp-1">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3.5">
                    <span className="text-[11.5px] text-muted-foreground tabular-nums">
                      <AnimatedNumber value={count} /> file{count !== 1 ? "s" : ""}
                      {p.updatedAt ? ` · edited ${timeAgo(p.updatedAt)}` : ""}
                    </span>
                    <div
                      className="flex items-center justify-center rounded-full text-primary-foreground text-[9px] font-semibold ring-2 ring-card"
                      style={{ width: 22, height: 22, background: "var(--ink)" }}
                      title="You"
                    >
                      {initialFor(p.title)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-9">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent activity
            </span>
            <div className="mt-3 space-y-2.5">
              {recent.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  disabled={busy}
                  className="flex items-center gap-3 text-[13px] w-full text-left rounded-lg px-1 py-0.5 hover:bg-accent transition-colors disabled:opacity-70"
                >
                  <div
                    className="flex items-center justify-center rounded-full text-white text-[9px] font-semibold flex-shrink-0"
                    style={{ width: 22, height: 22, background: accentFor(p.id) }}
                  >
                    {initialFor(p.title)}
                  </div>
                  <span className="text-foreground truncate">
                    <b className="font-medium">{p.title || "Untitled project"}</b> updated
                  </span>
                  <span className="text-muted-foreground text-[12px] tabular-nums ml-auto flex-shrink-0">
                    {timeAgo(p.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="rounded-2xl bg-card"
      style={{ border: `1px dashed ${BORDER}` }}
    >
      <SharedEmptyState
        size="lg"
        icon={FolderPlus}
        title="Create your first project"
        description="A project is your home for related docs, sheets, and decks, all connected through chat, so the AI always has context."
        action={{ label: "New project", onClick: onCreate, icon: Plus }}
      />
    </div>
  );
}

export default GlobalHome;
