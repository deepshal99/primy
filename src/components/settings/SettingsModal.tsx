"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Loader2, Check, Eye, EyeOff, LogOut, ChevronDown } from "lucide-react";
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
      <DialogContent className="sm:max-w-[460px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">Manage your account settings</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
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

