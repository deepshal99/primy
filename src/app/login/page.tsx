"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Pen, Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { design } from "@/lib/design";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      name: mode === "signup" ? name.trim() : "",
      mode,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      const msg = result.error;
      if (msg.includes("Email already registered")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (msg.includes("No account found")) {
        setError("No account found. Sign up to get started.");
      } else if (msg.includes("Incorrect password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } else if (result?.ok) {
      window.location.href = "/";
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl p-8 animate-fade-in"
        style={{
          backgroundColor: design.colors.bg.sidebar,
          boxShadow: design.shadows.xl,
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ backgroundColor: design.colors.brand.primary }}
          >
            <Pen className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h1
            className="text-display-sm"
            style={{ color: design.colors.text.sidebar }}
          >
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p
            className="text-body mt-1 text-center"
            style={{ color: design.colors.text.sidebarMuted }}
          >
            {mode === "signin"
              ? "Sign in to your Drafta AI workspace"
              : "Get started with AI-powered spreadsheets & docs"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name (signup only) */}
          {mode === "signup" && (
            <div className="relative animate-fade-in">
              <User
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: design.colors.text.sidebarDim }}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-body outline-none transition-colors"
                style={{
                  backgroundColor: design.colors.bg.sidebarHover,
                  borderColor: design.colors.border.sidebar,
                  color: design.colors.text.sidebar,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.text.sidebarDim; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: design.colors.text.sidebarDim }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="Email address"
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-body outline-none transition-colors"
              style={{
                backgroundColor: design.colors.bg.sidebarHover,
                borderColor: design.colors.border.sidebar,
                color: design.colors.text.sidebar,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.text.sidebarDim; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: design.colors.text.sidebarDim }}
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder={mode === "signup" ? "Create password (min 6 chars)" : "Password"}
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-body outline-none transition-colors"
              style={{
                backgroundColor: design.colors.bg.sidebarHover,
                borderColor: design.colors.border.sidebar,
                color: design.colors.text.sidebar,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.text.sidebarDim; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" style={{ color: design.colors.text.sidebarMuted }} />
              ) : (
                <Eye className="w-4 h-4" style={{ color: design.colors.text.sidebarMuted }} />
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-body-sm px-3 py-2 rounded-lg animate-fade-in"
              style={{
                color: "#E05555",
                backgroundColor: "rgba(224, 85, 85, 0.1)",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-[13px] font-semibold tracking-wide transition-all duration-200 disabled:opacity-60 hover:opacity-90"
            style={{
              backgroundColor: design.colors.brand.primary,
              color: design.colors.brand.text,
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p
          className="text-body-sm text-center mt-6"
          style={{ color: design.colors.text.sidebarMuted }}
        >
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="font-medium hover:underline"
            style={{ color: design.colors.brand.primary }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
