"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Loader2, Check, Eye, EyeOff, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { PRO_PRICE_USD } from "@/lib/plans";

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
  const [activeTab, setActiveTab] = useState<"account" | "billing">("account");

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
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
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
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPwSuccess(false);
        setPasswordOpen(false);
      }, 2000);
    } catch {
      setPwError("Network error");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">Manage your account settings</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "account" | "billing")}
          className="gap-0"
        >
          <div className="px-6 pt-4 pb-3 border-b border-border">
            <TabsList className="bg-muted h-8 w-full grid grid-cols-2 p-0.5" style={{ borderRadius: 8 }}>
              <TabsTrigger
                value="account"
                className="text-[12px] font-medium tabular-nums"
                style={{ borderRadius: 6 }}
              >
                Account
              </TabsTrigger>
              <TabsTrigger
                value="billing"
                className="text-[12px] font-medium tabular-nums"
                style={{ borderRadius: 6 }}
              >
                Billing
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
            <TabsContent value="account" className="m-0">
              {loading ? (
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
                  {/* Profile section */}
                  <div className="mb-6">
                    <SectionLabel>Profile</SectionLabel>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold flex-shrink-0 bg-[var(--color-brand-subtle)] text-[var(--color-brand)]">
                        {initials}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-foreground">{name}</p>
                        <p className="text-[13px] text-muted-foreground">{email}</p>
                      </div>
                    </div>

                    <FieldLabel>Name</FieldLabel>
                    <div className="flex gap-2 mb-1">
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setNameError("");
                          setNameSuccess(false);
                        }}
                        className="flex-1 text-[13px]"
                      />
                      <Button
                        onClick={handleSaveName}
                        disabled={nameSaving || name.trim() === session?.user?.name}
                        size="sm"
                      >
                        {nameSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : nameSuccess ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                    {nameError && (
                      <p className="text-xs mt-1 text-destructive">{nameError}</p>
                    )}

                    <FieldLabel className="mt-4">Email</FieldLabel>
                    <div className="px-3 py-2 rounded-lg text-[13px] bg-muted text-muted-foreground border border-border">
                      {email}
                    </div>

                    {createdAt && (
                      <p className="mt-3 text-xs text-muted-foreground/60">
                        Member since {createdAt}
                      </p>
                    )}
                  </div>

                  <div className="h-px mb-6 bg-border" />

                  {/* Security section */}
                  <div className="mb-6">
                    <SectionLabel>Security</SectionLabel>

                    <button
                      onClick={() => {
                        setPasswordOpen(!passwordOpen);
                        setPwError("");
                        setPwSuccess(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-[13px] font-medium text-foreground bg-muted hover:bg-accent"
                    >
                      Change password
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          passwordOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {passwordOpen && (
                      <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div>
                          <FieldLabel>Current password</FieldLabel>
                          <div className="relative">
                            <Input
                              type={showCurrentPw ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => {
                                setCurrentPassword(e.target.value);
                                setPwError("");
                              }}
                              className="pr-9 text-[13px]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPw(!showCurrentPw)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2"
                            >
                              {showCurrentPw ? (
                                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <FieldLabel>New password</FieldLabel>
                          <div className="relative">
                            <Input
                              type={showNewPw ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => {
                                setNewPassword(e.target.value);
                                setPwError("");
                              }}
                              placeholder="Min 6 characters"
                              className="pr-9 text-[13px]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPw(!showNewPw)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2"
                            >
                              {showNewPw ? (
                                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <FieldLabel>Confirm new password</FieldLabel>
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setPwError("");
                            }}
                            className="text-[13px]"
                          />
                        </div>

                        {pwError && (
                          <p className="text-xs text-destructive">{pwError}</p>
                        )}

                        {pwSuccess && (
                          <p className="text-xs text-emerald-500">
                            Password changed successfully
                          </p>
                        )}

                        <Button
                          onClick={handleChangePassword}
                          disabled={pwSaving}
                          size="sm"
                        >
                          {pwSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Update password"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="h-px mb-4 bg-border" />

                  {/* Sign out */}
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </>
              )}
            </TabsContent>

            <TabsContent value="billing" className="m-0">
              <BillingTabContent />
            </TabsContent>
          </div>
        </Tabs>
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
    bannerTitle = `You're on Pro (founding member — ${days} day${days === 1 ? "" : "s"} remaining)`;
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
          border: "1px solid rgba(0, 0, 0, 0.06)",
          backgroundColor: isPro ? "rgba(255, 180, 63, 0.08)" : "rgba(0, 0, 0, 0.02)",
        }}
      >
        <div
          className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center"
          style={{
            borderRadius: 8,
            backgroundColor: isPro ? "rgba(255, 180, 63, 0.14)" : "rgba(0, 0, 0, 0.04)",
            color: isPro ? "#B87426" : "#525252",
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col">
          <p className="text-[13px] font-semibold leading-tight text-foreground">
            {bannerTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {isPro && isOnGracePeriod
              ? "Enjoy full Pro access during your founding-member grace period."
              : isPro
              ? "Thanks for supporting Drafta."
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
                  className="text-[13px] font-medium text-white"
                  style={{
                    borderRadius: 6,
                    backgroundColor: "#1A1815",
                    opacity: 0.55,
                  }}
                >
                  Upgrade to Pro &mdash; ${PRO_PRICE_USD}/mo
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
            style={{ color: isHot ? "#B87426" : "#525252" }}
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
            backgroundColor: "rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            className="h-full transition-all duration-200 ease-out"
            style={{
              width: `${percent}%`,
              borderRadius: 9999,
              backgroundColor: isHot ? "#1A1815" : "#737373",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function FieldLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block mb-1.5 text-xs font-medium text-muted-foreground", className)}>
      {children}
    </label>
  );
}
