"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { GlobalHome } from "@/components/shell/GlobalHome";
import { TopBar } from "@/components/shell/TopBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { useAppStore } from "@/lib/store";
import { MessageSquare, PanelRight, Loader2 } from "lucide-react";

type MobilePanel = "chat" | "workspace";

const CANVAS = "#ecebe6";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06)";
const BORDER_FAINT = "rgba(0,0,0,0.05)";

// Onboarding-gate query — single source of truth for hasOnboarded in the
// shell. Reused by usePlanInfo via the same ["user"] key, so cached.
async function fetchUserForGate(): Promise<{ hasOnboarded: boolean }> {
  const res = await fetch("/api/user", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
  return res.json();
}

export function AppShell() {
  const router = useRouter();
  const pathname = usePathname();
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const resetAll = useAppStore((s) => s.resetAll);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const closeTab = useAppStore((s) => s.closeTab);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");

  // ── Onboarding guard ──
  // If the authenticated user hasn't onboarded yet AND they're not already
  // on /onboarding, redirect them. We block render until the query
  // resolves so the rest of the shell (which fetches projects on mount)
  // doesn't race with the redirect.
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: fetchUserForGate,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (userQuery.data && userQuery.data.hasOnboarded === false && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [userQuery.data, pathname, router]);

  // Fetch the project list once onboarding is confirmed. (The old NavRail used
  // to trigger this on mount; the shell overhaul removed NavRail, so the app
  // was silently running on the localStorage cache only — load from server.)
  useEffect(() => {
    if (userQuery.data?.hasOnboarded) {
      loadProjects();
    }
  }, [userQuery.data?.hasOnboarded, loadProjects]);

  // When an entity opens (e.g. AI creates one), flip mobile to the work pane.
  useEffect(() => {
    if (currentEntityId) setMobilePanel("workspace");
  }, [currentEntityId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          setSearchOpen(true);
        }
        if (e.key === "n") {
          e.preventDefault();
          resetAll();
        }
        if (e.key === "b") {
          e.preventDefault();
          window.dispatchEvent(new Event("drafta:toggle-sidebar"));
        }
        if (e.key === "/" && !e.shiftKey) {
          e.preventDefault();
          window.dispatchEvent(new Event("drafta:focus-chat"));
        }
        if (e.key === "w") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentEntityId) {
            closeTab(s.currentEntityId);
          }
        }
        if (e.key === "1") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentProjectId) {
            const project = s.projects.find((p) => p.id === s.currentProjectId);
            if (project && project.tables.length > 0) {
              s.openTable(project.tables[0].id);
              if (!s.workspaceOpen) useAppStore.setState({ workspaceOpen: true });
            }
          }
        }
        if (e.key === "2") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentProjectId) {
            const project = s.projects.find((p) => p.id === s.currentProjectId);
            if (project && project.knowledgeUnits.length > 0) {
              s.openKnowledgeUnit(project.knowledgeUnits[0].id);
              if (!s.workspaceOpen) useAppStore.setState({ workspaceOpen: true });
            }
          }
        }
        if (e.key === "z" && !e.shiftKey && canUndo) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
            e.preventDefault();
            undo();
          }
        }
        if (e.key === "z" && e.shiftKey && canRedo) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
            e.preventDefault();
            redo();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [resetAll, undo, redo, canUndo, canRedo, closeTab]);

  // Listen for search open event from the Sidebar.
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener("drafta:open-search", handler);
    return () => window.removeEventListener("drafta:open-search", handler);
  }, []);

  // The work pane and chat are both always present. On mobile a single panel
  // shows at a time; the floating toggle switches between them.
  const showMobileToggle = true;

  // Block render until onboarding gate resolves — prevents the project
  // list from auto-flipping hasOnboarded=true via /api/projects before
  // the user has been redirected to /onboarding.
  const needsOnboarding = userQuery.data && userQuery.data.hasOnboarded === false;
  if (userQuery.isLoading || needsOnboarding) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: CANVAS }}>
        <Loader2 className="w-5 h-5 animate-spin text-[#FFB43F]" />
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden text-[#171717]"
      style={{ background: CANVAS, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ZONE 1 — Top bar (transparent, on the canvas) */}
      <TopBar />

      {/* Row: sidebar (canvas) · chat (card) · work pane (card) */}
      <div className="flex flex-1 min-h-0" style={{ gap: 10, padding: "0 10px 10px 10px" }}>
        {/* ZONE 2 — Sidebar ON the canvas (hidden on mobile) */}
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar />
        </div>

        {/* ZONE 3 — Chat (floating card) */}
        <section
          data-chat-panel
          className={`flex flex-col flex-shrink-0 bg-white overflow-hidden w-full md:w-[27vw] md:min-w-[360px] md:max-w-[460px] ${
            mobilePanel === "workspace" && showMobileToggle ? "hidden md:flex" : "flex"
          }`}
          style={{
            borderRadius: 16,
            boxShadow: CARD_SHADOW,
            border: `1px solid ${BORDER_FAINT}`,
          }}
        >
          <ChatPanel centered={false} />
        </section>

        {/* ZONE 4 — Work pane (floating card) */}
        <main
          data-workspace-panel
          className={`flex-1 min-w-0 flex flex-col bg-white overflow-hidden ${
            mobilePanel === "chat" && showMobileToggle ? "hidden md:flex" : "flex"
          }`}
          style={{
            borderRadius: 16,
            boxShadow: CARD_SHADOW,
            border: `1px solid ${BORDER_FAINT}`,
          }}
        >
          {currentProjectId ? <WorkspacePanel /> : <GlobalHome />}
        </main>
      </div>

      {/* Mobile panel toggle */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-1 bg-white/90 backdrop-blur-md rounded-full p-1 shadow-[0_2px_12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setMobilePanel("chat")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none ${
            mobilePanel === "chat"
              ? "bg-[#1A1815] text-white shadow-sm"
              : "text-[#737373] hover:text-[#171717]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>
        <button
          onClick={() => setMobilePanel("workspace")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none ${
            mobilePanel === "workspace"
              ? "bg-[#1A1815] text-white shadow-sm"
              : "text-[#737373] hover:text-[#171717]"
          }`}
        >
          <PanelRight className="w-3.5 h-3.5" />
          Workspace
        </button>
      </div>

      <KeyboardShortcuts />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
