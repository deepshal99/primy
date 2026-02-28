"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { X, Loader2, Check, Eye, EyeOff, LogOut, ChevronDown, Sun, Moon, Monitor } from "lucide-react";
import { design } from "@/lib/design";
import { useTheme } from "@/lib/useTheme";
import { ThemeMode } from "@/lib/theme";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { data: session, update: updateSession } = useSession();
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

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
      // Refresh session so sidebar shows new name
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
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-[460px] rounded-xl overflow-hidden animate-scale-in"
        style={{
          backgroundColor: design.colors.bg.elevated,
          boxShadow: design.shadows.xl,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: design.colors.border.default }}
        >
          <h2
            style={{
              fontFamily: design.typography.family.heading,
              fontSize: "18px",
              fontWeight: 600,
              color: design.colors.text.primary,
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = design.colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X className="w-4 h-4" style={{ color: design.colors.text.muted }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="w-5 h-5 animate-spin"
                style={{ color: design.colors.text.muted }}
              />
            </div>
          ) : (
            <>
              {/* ── Profile section ── */}
              <div className="mb-6">
                <SectionLabel>Profile</SectionLabel>

                {/* Avatar + name display */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: design.colors.brand.subtle,
                      color: design.colors.brand.primary,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: design.colors.text.primary,
                        fontFamily: design.typography.family.heading,
                      }}
                    >
                      {name}
                    </p>
                    <p style={{ fontSize: "13px", color: design.colors.text.muted }}>
                      {email}
                    </p>
                  </div>
                </div>

                {/* Name field */}
                <FieldLabel>Name</FieldLabel>
                <div className="flex gap-2 mb-1">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError("");
                      setNameSuccess(false);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                    style={{
                      backgroundColor: design.colors.bg.secondary,
                      border: `1px solid ${design.colors.border.default}`,
                      color: design.colors.text.primary,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = design.colors.brand.primary;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = design.colors.border.default;
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameSaving || name.trim() === session?.user?.name}
                    className="px-3 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-40"
                    style={{
                      backgroundColor: design.colors.brand.primary,
                      color: "#fff",
                    }}
                  >
                    {nameSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : nameSuccess ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
                {nameError && (
                  <p className="text-[12px] mt-1" style={{ color: "#E05555" }}>
                    {nameError}
                  </p>
                )}

                {/* Email (read-only) */}
                <FieldLabel className="mt-4">Email</FieldLabel>
                <div
                  className="px-3 py-2 rounded-lg text-[13px]"
                  style={{
                    backgroundColor: design.colors.bg.tertiary,
                    color: design.colors.text.muted,
                    border: `1px solid ${design.colors.border.light}`,
                  }}
                >
                  {email}
                </div>

                {/* Member since */}
                {createdAt && (
                  <p className="mt-3 text-[12px]" style={{ color: design.colors.text.placeholder }}>
                    Member since {createdAt}
                  </p>
                )}
              </div>

              {/* ── Divider ── */}
              <div
                className="h-px mb-6"
                style={{ backgroundColor: design.colors.border.default }}
              />

              {/* ── Appearance section ── */}
              <ThemeSection />

              {/* ── Divider ── */}
              <div
                className="h-px mb-6"
                style={{ backgroundColor: design.colors.border.default }}
              />

              {/* ── Security section ── */}
              <div className="mb-6">
                <SectionLabel>Security</SectionLabel>

                <button
                  onClick={() => {
                    setPasswordOpen(!passwordOpen);
                    setPwError("");
                    setPwSuccess(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-[13px]"
                  style={{
                    backgroundColor: design.colors.bg.secondary,
                    color: design.colors.text.primary,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = design.colors.bg.tertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = design.colors.bg.secondary;
                  }}
                >
                  Change password
                  <ChevronDown
                    className="w-4 h-4 transition-transform"
                    style={{
                      color: design.colors.text.muted,
                      transform: passwordOpen ? "rotate(180deg)" : "rotate(0)",
                    }}
                  />
                </button>

                {passwordOpen && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    {/* Current password */}
                    <div>
                      <FieldLabel>Current password</FieldLabel>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            setPwError("");
                          }}
                          className="w-full px-3 py-2 pr-9 rounded-lg text-[13px] outline-none transition-colors"
                          style={{
                            backgroundColor: design.colors.bg.secondary,
                            border: `1px solid ${design.colors.border.default}`,
                            color: design.colors.text.primary,
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor =
                              design.colors.brand.primary;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor =
                              design.colors.border.default;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2"
                        >
                          {showCurrentPw ? (
                            <EyeOff
                              className="w-3.5 h-3.5"
                              style={{ color: design.colors.text.muted }}
                            />
                          ) : (
                            <Eye
                              className="w-3.5 h-3.5"
                              style={{ color: design.colors.text.muted }}
                            />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div>
                      <FieldLabel>New password</FieldLabel>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPwError("");
                          }}
                          placeholder="Min 6 characters"
                          className="w-full px-3 py-2 pr-9 rounded-lg text-[13px] outline-none transition-colors"
                          style={{
                            backgroundColor: design.colors.bg.secondary,
                            border: `1px solid ${design.colors.border.default}`,
                            color: design.colors.text.primary,
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor =
                              design.colors.brand.primary;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor =
                              design.colors.border.default;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2"
                        >
                          {showNewPw ? (
                            <EyeOff
                              className="w-3.5 h-3.5"
                              style={{ color: design.colors.text.muted }}
                            />
                          ) : (
                            <Eye
                              className="w-3.5 h-3.5"
                              style={{ color: design.colors.text.muted }}
                            />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm */}
                    <div>
                      <FieldLabel>Confirm new password</FieldLabel>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPwError("");
                        }}
                        className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                        style={{
                          backgroundColor: design.colors.bg.secondary,
                          border: `1px solid ${design.colors.border.default}`,
                          color: design.colors.text.primary,
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor =
                            design.colors.brand.primary;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor =
                            design.colors.border.default;
                        }}
                      />
                    </div>

                    {pwError && (
                      <p className="text-[12px]" style={{ color: "#E05555" }}>
                        {pwError}
                      </p>
                    )}

                    {pwSuccess && (
                      <p className="text-[12px]" style={{ color: design.colors.brand.primary }}>
                        Password changed successfully
                      </p>
                    )}

                    <button
                      onClick={handleChangePassword}
                      disabled={pwSaving}
                      className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: design.colors.brand.primary,
                        color: "#fff",
                      }}
                    >
                      {pwSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Update password"
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div
                className="h-px mb-4"
                style={{ backgroundColor: design.colors.border.default }}
              />

              {/* Sign out */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{ color: "#E05555" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(224,85,85,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: design.colors.text.muted,
      }}
    >
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
    <label
      className={`block mb-1.5 ${className}`}
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: design.colors.text.secondary,
      }}
    >
      {children}
    </label>
  );
}

const themeOptions: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "dark", icon: Moon, label: "Dark" },
  { mode: "system", icon: Monitor, label: "System" },
];

function ThemeSection() {
  const { mode, setMode } = useTheme();

  return (
    <div className="mb-6">
      <SectionLabel>Appearance</SectionLabel>
      <div className="flex gap-2">
        {themeOptions.map((opt) => {
          const isActive = mode === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => setMode(opt.mode)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all border"
              style={{
                backgroundColor: isActive ? design.colors.brand.subtle : design.colors.bg.secondary,
                borderColor: isActive ? design.colors.brand.primary : design.colors.border.default,
                color: isActive ? design.colors.brand.primary : design.colors.text.secondary,
              }}
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
