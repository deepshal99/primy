"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Plus,
  Table2,
  FileText,
  Trash2,
  MoreHorizontal,
  Pencil,
  MessageSquare,
  Search,
  PanelLeft,
  LogOut,
  Sparkles,
  Ellipsis,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Conversation } from "@/lib/types";
import { design } from "@/lib/design";

export function HistorySidebar() {
  const { data: session } = useSession();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const conversations = useAppStore((s) => s.conversations);
  const currentConversationId = useAppStore((s) => s.currentConversationId);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const loadConversation = useAppStore((s) => s.loadConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const renameConversation = useAppStore((s) => s.renameConversation);
  const newConversation = useAppStore((s) => s.newConversation);
  const loadConversations = useAppStore((s) => s.loadConversations);

  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const grouped = groupByDate(filtered);

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      renameConversation(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const initials = session?.user?.name
    ? getInitials(session.user.name)
    : "U";

  // Collapsed state — dark thin strip
  if (!sidebarOpen) {
    return (
      <div
        className="h-full flex-shrink-0 flex flex-col items-center py-3 gap-2 border-r"
        style={{
          width: 48,
          backgroundColor: design.colors.bg.sidebar,
          borderColor: design.colors.border.sidebar,
        }}
      >
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors icon-btn-hover"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Open sidebar"
        >
          <PanelLeft className="w-4 h-4 icon-panel-flip" />
        </button>
        <button
          onClick={newConversation}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors icon-btn-hover"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover;
            e.currentTarget.style.color = design.colors.brand.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = design.colors.text.sidebarMuted;
          }}
          title="New chat"
        >
          <Plus className="w-4 h-4 icon-plus-hover" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full flex-shrink-0 border-r flex flex-col"
      style={{
        width: 260,
        backgroundColor: design.colors.bg.sidebar,
        borderColor: design.colors.border.sidebar,
      }}
    >
      {/* Top: New chat + collapse */}
      <div className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Close sidebar"
        >
          <PanelLeft className="w-4 h-4 icon-panel-flip" />
        </button>
        <div className="flex-1" />
        <button
          onClick={newConversation}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover;
            e.currentTarget.style.color = design.colors.brand.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = design.colors.text.sidebarMuted;
          }}
          title="New chat"
        >
          <Plus className="w-4 h-4 icon-plus-hover" />
        </button>
      </div>

      {/* Search */}
      {conversations.length > 3 && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: design.colors.text.sidebarDim }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-ui-sm outline-none transition-colors"
              style={{
                backgroundColor: design.colors.bg.sidebarHover,
                borderColor: design.colors.border.sidebar,
                color: design.colors.text.sidebar,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.text.sidebarDim; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
            />
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <MessageSquare
              className="w-6 h-6 mb-2"
              style={{ color: design.colors.text.sidebarDim }}
              strokeWidth={1}
            />
            <p
              className="text-label text-center"
              style={{ color: design.colors.text.sidebarMuted }}
            >
              {search ? "No matching chats" : "No conversations yet"}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([label, convs]) => (
            <div key={label} className="mb-1">
              <p
                className="text-overline px-2 py-1.5 sticky top-0"
                style={{ color: design.colors.text.sidebarDim, backgroundColor: design.colors.bg.sidebar }}
              >
                {label}
              </p>
              <div className="flex flex-col gap-px">
                {convs.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === currentConversationId}
                    isMenuOpen={menuOpenId === conv.id}
                    isRenaming={renamingId === conv.id}
                    renameValue={renameValue}
                    menuRef={menuRef}
                    onClick={() => loadConversation(conv.id)}
                    onMenuToggle={() =>
                      setMenuOpenId(menuOpenId === conv.id ? null : conv.id)
                    }
                    onRenameStart={() => {
                      setRenamingId(conv.id);
                      setRenameValue(conv.title);
                      setMenuOpenId(null);
                    }}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={() => handleRename(conv.id)}
                    onDelete={() => {
                      deleteConversation(conv.id);
                      setMenuOpenId(null);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom: User */}
      <div className="flex-shrink-0 border-t px-2 py-2 relative" style={{ borderColor: design.colors.border.sidebar }} ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-label font-semibold flex-shrink-0"
            style={{
              backgroundColor: design.colors.brand.subtle,
              color: design.colors.brand.primary,
            }}
          >
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-ui-sm truncate" style={{ color: design.colors.text.sidebar }}>
              {session?.user?.name || "User"}
            </p>
          </div>
          <Ellipsis className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.text.sidebarMuted }} />
        </button>

        {userMenuOpen && (
          <div
            className="absolute left-2 right-2 bottom-full mb-1 z-50 border rounded-xl py-1 animate-scale-in"
            style={{
              backgroundColor: design.colors.bg.sidebarHover,
              borderColor: design.colors.border.sidebar,
              boxShadow: design.shadows.dropdown,
            }}
          >
            {session?.user?.email && (
              <div className="px-3 py-1.5 border-b" style={{ borderColor: design.colors.border.sidebar }}>
                <p className="text-label truncate" style={{ color: design.colors.text.sidebarMuted }}>
                  {session.user.email}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setUserMenuOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-ui-sm transition-colors text-left"
              style={{ color: "#E05555" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 85, 85, 0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Conversation Item ──

function ConversationItem({
  conv,
  isActive,
  isMenuOpen,
  isRenaming,
  renameValue,
  menuRef,
  onClick,
  onMenuToggle,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  isMenuOpen: boolean;
  isRenaming: boolean;
  renameValue: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  onMenuToggle: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-colors duration-100"
        style={{
          backgroundColor: isActive ? design.colors.bg.sidebarActive : "transparent",
          borderLeft: isActive ? `2px solid ${design.colors.brand.primary}` : "2px solid transparent",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {/* Title */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={onRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit();
                if (e.key === "Escape") onRenameSubmit();
              }}
              className="w-full text-body-sm bg-transparent outline-none border-b pb-0.5"
              style={{ color: design.colors.text.sidebar, borderColor: design.colors.brand.primary }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-body-sm truncate"
              style={{
                color: isActive ? design.colors.text.sidebar : design.colors.text.sidebarMuted,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {conv.title}
            </p>
          )}
        </div>

        {/* Type badges */}
        {!isRenaming && (conv.hasSheet || conv.hasDoc) && (
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60">
            {conv.hasSheet && (
              <Table2 className="w-3 h-3" style={{ color: design.colors.accent.teal }} strokeWidth={1.5} />
            )}
            {conv.hasDoc && (
              <FileText className="w-3 h-3" style={{ color: design.colors.accent.purple }} strokeWidth={1.5} />
            )}
          </div>
        )}
      </button>

      {/* More menu button — appears on hover */}
      {!isRenaming && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarActive; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 border rounded-lg py-1 min-w-[120px] animate-scale-in"
          style={{
            backgroundColor: design.colors.bg.sidebarHover,
            borderColor: design.colors.border.sidebar,
            boxShadow: design.shadows.dropdown,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-ui-sm transition-colors text-left"
            style={{ color: design.colors.text.sidebar }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarActive; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Pencil className="w-3 h-3" />
            Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-ui-sm transition-colors text-left"
            style={{ color: "#E05555" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 85, 85, 0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Trash2 className="w-3 h-3 icon-trash-wobble" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  for (const conv of conversations) {
    let label: string;
    if (conv.updatedAt >= today) label = "Today";
    else if (conv.updatedAt >= yesterday) label = "Yesterday";
    else if (conv.updatedAt >= weekAgo) label = "This Week";
    else label = "Older";
    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }

  return groups;
}
