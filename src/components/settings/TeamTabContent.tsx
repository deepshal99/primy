"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, UserPlus, Building2, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useOrg, type OrgMember } from "@/hooks/useOrg";
import { Skeleton } from "@/components/ui/skeleton";

const FIELD =
  "w-full h-10 rounded-[10px] px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none border transition-[border-color,box-shadow] focus:ring-2 focus:ring-[var(--accent-amber)]/25 focus:border-[var(--accent-amber)]/55";
const FIELD_STYLE: React.CSSProperties = {
  background: "var(--input-background)",
  borderColor: "var(--border)",
};

export function TeamTabContent() {
  const { data: session } = useSession();
  const meId = session?.user?.id;
  const { org, members, loading, createOrg, invite, removeMember, deleteOrg } = useOrg();

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading team">
        <Skeleton variant="shimmer" className="h-16 w-full" style={{ borderRadius: 10 }} />
        <Skeleton className="h-[44px] w-full" style={{ borderRadius: 8 }} />
        <Skeleton className="h-[44px] w-full" style={{ borderRadius: 8 }} />
      </div>
    );
  }

  if (!org) return <CreateOrgForm pending={createOrg.isPending} onCreate={(n) => createOrg.mutate(n, {
    onSuccess: () => toast.success("Organization created"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  })} />;

  const myRole = org.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  return (
    <div>
      {/* Org banner */}
      <div
        className="mb-6 flex items-center gap-3 px-4 py-3.5"
        style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--secondary)" }}
      >
        <div
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center"
          style={{ borderRadius: 8, background: "var(--muted)", color: "var(--ink-2)" }}
        >
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-foreground truncate">{org.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} · you are {myRole}
            {org.plan === "pro" ? " · Pro" : ""}
          </p>
        </div>
      </div>

      {/* Invite (admins+) */}
      {canManage && (
        <div className="mb-6">
          <SectionLabel>Invite a teammate</SectionLabel>
          <InviteRow
            pending={invite.isPending}
            onInvite={(email, role) =>
              invite.mutate(
                { email, role },
                {
                  onSuccess: () => toast.success("Member added"),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to invite"),
                }
              )
            }
          />
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            They must already have a Primy account. Email invites for new users are coming soon.
          </p>
        </div>
      )}

      {/* Members */}
      <div className="mb-6">
        <SectionLabel>Members</SectionLabel>
        <div className="space-y-1">
          {members
            .slice()
            .sort((a, b) => roleRank(b.role) - roleRank(a.role))
            .map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                isMe={m.userId === meId}
                canManage={canManage}
                onRemove={() =>
                  removeMember.mutate(m.userId, {
                    onSuccess: () => toast.success(m.userId === meId ? "You left the organization" : "Member removed"),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
                  })
                }
              />
            ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="h-px mb-4 bg-border" />
      {isOwner ? (
        <DangerButton
          label="Delete organization"
          confirmLabel="Delete it — this can't be undone"
          onConfirm={() =>
            deleteOrg.mutate(undefined, {
              onSuccess: () => toast.success("Organization deleted"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
            })
          }
        />
      ) : (
        <DangerButton
          label="Leave organization"
          confirmLabel="Yes, leave this organization"
          onConfirm={() =>
            meId &&
            removeMember.mutate(meId, {
              onSuccess: () => toast.success("You left the organization"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to leave"),
            })
          }
        />
      )}
    </div>
  );
}

function roleRank(role: string): number {
  return role === "owner" ? 2 : role === "admin" ? 1 : 0;
}

function CreateOrgForm({ pending, onCreate }: { pending: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div>
      <div
        className="mb-5 flex items-start gap-3 px-4 py-3.5"
        style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--secondary)" }}
      >
        <div
          className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center"
          style={{ borderRadius: 8, background: "var(--muted)", color: "var(--ink-2)" }}
        >
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground">
          Create an organization to share projects with your team. Everyone gets their own login;
          projects stay private until you choose to share them with the org.
        </p>
      </div>
      <FieldLabel>Organization name</FieldLabel>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc."
          className={cn(FIELD, "flex-1")}
          style={FIELD_STYLE}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !pending) onCreate(name.trim());
          }}
        />
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          disabled={pending || !name.trim()}
          className="h-10 px-4 rounded-[10px] text-[13px] font-medium press disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[80px]"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
        </button>
      </div>
    </div>
  );
}

function InviteRow({
  pending,
  onInvite,
}: {
  pending: boolean;
  onInvite: (email: string, role: "admin" | "member") => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const submit = () => {
    if (!email.trim()) return;
    onInvite(email.trim(), role);
    setEmail("");
  };
  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teammate@company.com"
        className={cn(FIELD, "flex-1")}
        style={FIELD_STYLE}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "admin" | "member")}
        className="h-10 rounded-[10px] px-2 text-[13px] outline-none border"
        style={FIELD_STYLE}
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button
        onClick={submit}
        disabled={pending || !email.trim()}
        className="h-10 px-3 rounded-[10px] press disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        aria-label="Invite"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-4 h-4" />}
      </button>
    </div>
  );
}

function MemberRow({
  member,
  isMe,
  canManage,
  onRemove,
}: {
  member: OrgMember;
  isMe: boolean;
  canManage: boolean;
  onRemove: () => void;
}) {
  const isOwner = member.role === "owner";
  // Admins can remove members/other-admins (not the owner). Anyone can leave (self).
  const showRemove = (!isOwner && canManage && !isMe) || (isMe && !isOwner);
  const initials = (member.name || member.email || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-[8px] hover-row">
      <div
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center text-[12px] font-semibold text-white"
        style={{ borderRadius: 9999, background: isOwner ? "var(--accent-amber-deep)" : "var(--accent-purple)" }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate">
          {member.name || member.email}
          {isMe && <span className="text-muted-foreground font-normal"> (you)</span>}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
      </div>
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium capitalize"
        style={{ color: isOwner ? "var(--accent-amber-deep)" : "var(--ink-3)" }}
      >
        {isOwner && <Crown className="w-3 h-3" />}
        {member.role}
      </span>
      {showRemove && (
        <button
          onClick={onRemove}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-[6px] press text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label={isMe ? "Leave" : "Remove member"}
          title={isMe ? "Leave" : "Remove member"}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** Two-step destructive button — no native confirm() (those are being removed). */
function DangerButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      onClick={() => {
        if (armed) onConfirm();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block mb-1.5 text-xs font-medium text-muted-foreground">{children}</label>;
}
