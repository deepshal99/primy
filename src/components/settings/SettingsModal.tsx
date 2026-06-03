"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Loader2, Check, Eye, EyeOff, LogOut, ChevronDown, Crown, Sun, Moon, Monitor, User, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme, type Theme } from "@/lib/theme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { PRO_PRICE_USD } from "@/lib/plans";
import { TeamTabContent } from "@/components/settings/TeamTabContent";

/** One field style for the whole modal — soft fill, hairline border, amber focus. */
const FIELD =
  "w-full h-10 rounded-[10px] px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none border transition-[border-color,box-shadow] focus:ring-2 focus:ring-[var(--accent-amber)]/25 focus:border-[var(--accent-amber)]/55";
const FIELD_STYLE: React.CSSProperties = {
  background: "var(--input-background)",
  borderColor: "var(--border)",
};

type SettingsTab = "account" | "team" | "billing";

const TABS: { key: SettingsTab; label: string; Icon: typeof User }[] = [
  { key: "account", label: "Account", Icon: User },
  { key: "team", label: "Team", Icon: Users },
  { key: "billing", label: "Plan & usage", Icon: CreditCard },
];

const TAB_META: Record<SettingsTab, { title: string; subtitle: string }> = {
  account: { title: "Account", subtitle: "Your profile, appearance, and security." },
  team: { title: "Team", subtitle: "Your organization and its members." },
  billing: { title: "Plan & usage", subtitle: "Your plan and this month's usage." },
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { data: session, update: updateSession } = useSession();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState("");

  // Password state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  // Loading
  const [loading, setLoading] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState<"account" | "team" | "billing">("account");

  // Fetch user data on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setNameSuccess(false);
    setNameError("");
    setPwSuccess(false);
    setPwError("");
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setActiveTab("account");

    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.createdAt) {
          setCreatedAt(
            new Date(data.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const initials = name
    ? name
        .trim()
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name cannot be empty");
      return;
    }
    if (trimmed === session?.user?.name) return;

    setNameSaving(true);
    setNameError("");
    setNameSuccess(false);

    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error || "Failed to update name");
        return;
      }
      await updateSession();
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2000);
    } catch {
      setNameError("Network error");
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess(false);

    if (!currentPassword) {
      setPwError("Enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "Failed to change password");
        return;
      }
      // Changing the password revokes all sessions (tokenVersion bump), so sign
      // out gracefully and send the user to log in fresh — rather than letting
      // their session drop on its own a few seconds later.
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 1500);
    } catch {
      setPwError("Network error");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-[760px] p-0 gap-0 overflow-hidden border-0 shadow-none"
        style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)", borderRadius: 16 }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account, team, and plan</DialogDescription>
        </DialogHeader>

        <div className="flex" style={{ height: "min(80vh, 560px)" }}>
          {/* Left nav rail */}
          <aside
            className="w-[200px] flex-shrink-0 flex flex-col gap-0.5 p-3"
            style={{ background: "var(--sidebar)", borderRight: "1px solid var(--border)" }}
          >
            <p className="px-2.5 pt-1 pb-2.5 text-[12.5px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink-2)" }}>
              Settings
            </p>
            {TABS.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex items-center gap-2.5 h-9 px-2.5 rounded-[8px] text-[13px] font-medium press transition-colors"
                  style={{
                    background: active ? "var(--card)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    boxShadow: active ? "var(--shadow-card)" : "none",
                  }}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </aside>

          {/* Right column */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-7 pt-6 pb-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
                {TAB_META[activeTab].title}
              </h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                {TAB_META[activeTab].subtitle}
              </p>
            </div>

            <div className="px-7 pb-7 flex-1 overflow-y-auto v2-scroll">
            {activeTab === "account" && (
              loading ? (
                <div className="space-y-5" aria-label="Loading account">
                  {/* Avatar + name + email row */}
                  <div className="flex items-center gap-3">
                    <Skeleton variant="shimmer" className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-[14px] w-[160px] rounded" />
                      <Skeleton className="h-[12px] w-[200px] rounded" />
                    </div>
                  </div>
                  {/* Name field */}
                  <div className="space-y-2">
                    <Skeleton className="h-[10px] w-[40px] rounded" />
                    <Skeleton className="h-9 w-full" style={{ borderRadius: 6 }} />
                  </div>
                  {/* Email field */}
                  <div className="space-y-2">
                    <Skeleton className="h-[10px] w-[40px] rounded" />
                    <Skeleton className="h-9 w-full" style={{ borderRadius: 6 }} />
                  </div>
                  {/* Security section */}
                  <div className="pt-3 space-y-2">
                    <Skeleton className="h-[10px] w-[60px] rounded" />
                    <Skeleton className="h-10 w-full" style={{ borderRadius: 8 }} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Profile */}
                  <div className="flex items-center gap-3.5 mb-7">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold flex-shrink-0 text-white" style={{ background: "var(--accent-purple)" }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground truncate">{name || "You"}</p>
                      <p className="text-[12.5px] text-muted-foreground truncate">
                        {email}{createdAt ? `  ·  since ${createdAt}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Account group — inline-editable rows */}
                  <SectionLabel>Account</SectionLabel>
                  <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3 px-3.5 h-[52px]">
                      <span className="text-[13px] flex-shrink-0" style={{ color: "var(--ink-2)", width: 88 }}>Name</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setNameError(""); setNameSuccess(false); }}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        placeholder="Your name"
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-right text-foreground placeholder:text-muted-foreground"
                      />
                      <span className="w-4 flex-shrink-0 flex items-center justify-center">
                        {nameSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : nameSuccess ? (
                          <Check className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
                        ) : null}
                      </span>
                    </div>
                    <div className="h-px" style={{ background: "var(--border)" }} />
                    <div className="flex items-center gap-3 px-3.5 h-[52px]">
                      <span className="text-[13px] flex-shrink-0" style={{ color: "var(--ink-2)", width: 88 }}>Email</span>
                      <span className="flex-1 min-w-0 text-[13px] text-right text-muted-foreground truncate">{email}</span>
                    </div>
                  </div>
                  {nameError && (
                    <p className="text-xs mt-2 text-destructive">{nameError}</p>
                  )}

                  {/* Preferences group */}
                  <SectionLabel className="mt-7">Preferences</SectionLabel>
                  <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3 px-3.5 h-[52px]">
                      <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>Theme</span>
                      <div className="flex-1" />
                      <ThemeRowControl />
                    </div>
                    <div className="h-px" style={{ background: "var(--border)" }} />
                    <button
                      onClick={() => { setPasswordOpen(!passwordOpen); setPwError(""); setPwSuccess(false); }}
                      className="w-full flex items-center gap-3 px-3.5 h-[52px] hover-row text-left press"
                    >
                      <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>Password</span>
                      <div className="flex-1" />
                      <span className="text-[12.5px] text-muted-foreground">Change</span>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", passwordOpen && "rotate-180")} />
                    </button>
                  </div>

                  {/* Password change — expands below the group */}
                  {passwordOpen && (
                    <div className="mt-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="relative">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); }}
                          placeholder="Current password"
                          className={cn(FIELD, "pr-9")}
                          style={FIELD_STYLE}
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          {showCurrentPw ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setPwError(""); }}
                          placeholder="New password (min 6 characters)"
                          className={cn(FIELD, "pr-9")}
                          style={FIELD_STYLE}
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          {showNewPw ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); }}
                        placeholder="Confirm new password"
                        className={FIELD}
                        style={FIELD_STYLE}
                      />
                      {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                      {pwSuccess && <p className="text-xs" style={{ color: "var(--color-success)" }}>Password changed successfully</p>}
                      <button
                        onClick={handleChangePassword}
                        disabled={pwSaving}
                        className="w-full h-10 rounded-[10px] text-[13px] font-medium press disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update password"}
                      </button>
                    </div>
                  )}

                  {/* Sign out */}
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="mt-7 w-full flex items-center justify-center gap-2 h-10 rounded-[10px] text-[13px] font-medium hover-row press"
                    style={{ color: "var(--destructive)" }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </>
              )
            )}

            {activeTab === "team" && <TeamTabContent />}

            {activeTab === "billing" && <BillingTabContent />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Billing tab
// ----------------------------------------------------------------------------

function BillingTabContent() {
  const info = usePlanInfo();

  if (info.loading) {
    return (
      <div className="space-y-5" aria-label="Loading billing">
        {/* Plan banner */}
        <Skeleton variant="shimmer" className="h-16 w-full" style={{ borderRadius: 10 }} />
        {/* Usage rows */}
        <div className="space-y-3">
          <Skeleton className="h-[44px] w-full" style={{ borderRadius: 8 }} />
          <Skeleton className="h-[44px] w-full" style={{ borderRadius: 8 }} />
          <Skeleton className="h-[44px] w-full" style={{ borderRadius: 8 }} />
        </div>
        {/* CTA */}
        <Skeleton className="h-9 w-40" style={{ borderRadius: 6 }} />
      </div>
    );
  }

  const { plan, isOnGracePeriod, daysRemainingInGrace, limits, usage, percentUsed } = info;
  const isPro = plan === "pro";

  let bannerTitle: string;
  if (isPro && isOnGracePeriod) {
    const days = daysRemainingInGrace ?? 0;
    bannerTitle = `You're on Pro (founding member, ${days} day${days === 1 ? "" : "s"} remaining)`;
  } else if (isPro) {
    bannerTitle = "You're on Pro";
  } else {
    bannerTitle = "You're on Free";
  }

  return (
    <div className="tabular-nums" style={{ fontFeatureSettings: "'tnum'" }}>
      {/* Current plan banner */}
      <div
        className="mb-6 flex items-start gap-3 px-4 py-3.5"
        style={{
          borderRadius: 10,
          border: "1px solid var(--border)",
          backgroundColor: isPro ? "rgba(255, 180, 63, 0.08)" : "var(--secondary)",
        }}
      >
        <div
          className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center"
          style={{
            borderRadius: 8,
            backgroundColor: isPro ? "rgba(255, 180, 63, 0.14)" : "var(--muted)",
            color: isPro ? "var(--accent-amber-deep)" : "var(--muted-foreground)",
          }}
        >
          <Crown className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col">
          <p className="text-[13px] font-semibold leading-tight text-foreground">
            {bannerTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {isPro && isOnGracePeriod
              ? "Enjoy full Pro access during your founding-member grace period."
              : isPro
              ? "Thanks for supporting Primy."
              : "Upgrade for higher limits, brand profiles, and no watermark."}
          </p>
        </div>
      </div>

      {/* Usage */}
      <div className="mb-6">
        <SectionLabel>Usage this month</SectionLabel>
        <div className="space-y-4">
          <UsageRow
            label="AI messages"
            used={usage.aiMessages}
            limit={limits.aiMessagesPerMonth}
            percent={percentUsed.aiMessages}
          />
          <UsageRow
            label="File uploads"
            used={usage.fileUploads}
            limit={limits.fileUploadsPerMonth}
            percent={percentUsed.fileUploads}
          />
          <UsageRow
            label="Storage"
            used={usage.storageBytes}
            limit={limits.storageBytes}
            percent={percentUsed.storageBytes}
            formatter={formatBytes}
          />
        </div>
      </div>

      <div className="h-px mb-5 bg-border" />

      {/* CTA: upgrade or manage */}
      <div>
        {!isPro && !isOnGracePeriod && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  disabled
                  className="text-[13px] font-medium text-primary-foreground"
                  style={{
                    borderRadius: 6,
                    backgroundColor: "var(--primary)",
                    opacity: 0.55,
                  }}
                >
                  Upgrade to Pro: ${PRO_PRICE_USD}/mo
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        )}

        {isPro && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  variant="outline"
                  disabled
                  className="text-[13px]"
                  style={{ borderRadius: 6, opacity: 0.6 }}
                >
                  Manage subscription
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        )}

        <p className="mt-2.5 text-[11px] text-muted-foreground/80">
          Payment gateway not yet wired. All limits are temporarily lifted during beta.
        </p>
      </div>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  percent,
  formatter,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  formatter?: (n: number) => string;
}) {
  const isUnlimited = !Number.isFinite(limit);
  const fmt = formatter ?? ((n: number) => n.toLocaleString("en-US"));
  const isHot = percent >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12px] tabular-nums">
        <span className="font-medium text-foreground">{label}</span>
        {isUnlimited ? (
          <span className="text-muted-foreground">{fmt(used)} &middot; Unlimited</span>
        ) : (
          <span
            className="font-medium"
            style={{ color: isHot ? "var(--accent-amber-deep)" : "var(--muted-foreground)" }}
          >
            {fmt(used)} <span className="text-muted-foreground">/ {fmt(limit)}</span>
          </span>
        )}
      </div>
      {!isUnlimited && (
        <div
          className="h-1.5 w-full overflow-hidden"
          style={{
            borderRadius: 9999,
            backgroundColor: "var(--muted)",
          }}
        >
          <div
            className="h-full transition-all duration-200 ease-out"
            style={{
              width: `${percent}%`,
              borderRadius: 9999,
              backgroundColor: isHot ? "var(--primary)" : "var(--ink-3)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = unit >= 2 && value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

/** Compact icon segmented control for the Theme row (Light / Dark / System). */
function ThemeRowControl() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];
  return (
    <div className="flex items-center gap-[3px] p-[3px]" style={{ background: "var(--secondary)", borderRadius: 9 }} role="radiogroup" aria-label="Theme">
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className="flex items-center justify-center w-[30px] h-[26px] press"
            style={{
              borderRadius: 6,
              background: active ? "var(--card)" : "transparent",
              boxShadow: active ? "var(--shadow-card)" : "none",
              color: active ? "var(--ink)" : "var(--ink-3)",
            }}
          >
            <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground", className)}>
      {children}
    </p>
  );
}

