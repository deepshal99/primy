"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="text-center">
        <h1
          className="text-[22px] text-[#1a1a2e] tracking-[-0.02em] mb-2"
          style={{ fontFamily: "'Degular', 'Inter', sans-serif", fontWeight: 600 }}
        >
          Invalid reset link
        </h1>
        <p className="text-[14px] text-[#95928E] mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-[#1A1815] text-white text-[14px] font-medium hover:bg-black transition-colors"
        >
          Request a new link
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-[#2e9e47]/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-5 h-5 text-[#2e9e47]" />
        </div>
        <h1
          className="text-[22px] text-[#1a1a2e] tracking-[-0.02em] mb-2"
          style={{ fontFamily: "'Degular', 'Inter', sans-serif", fontWeight: 600 }}
        >
          Password updated
        </h1>
        <p className="text-[14px] text-[#95928E]">
          Redirecting you to login...
        </p>
      </div>
    );
  }

  return (
    <>
      <h1
        className="text-[22px] text-[#1a1a2e] tracking-[-0.02em] mb-1.5"
        style={{ fontFamily: "'Degular', 'Inter', sans-serif", fontWeight: 600 }}
      >
        Set new password
      </h1>
      <p className="text-[14px] text-[#95928E] mb-8">
        Choose a new password for your account
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* New password */}
        <div>
          <label className="block text-[11px] font-medium text-[#8a877f] uppercase tracking-wider mb-1.5 ml-0.5">
            New password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Min 6 characters"
              autoFocus
              required
              className="w-full h-11 px-4 pr-11 rounded-xl border border-[rgba(24,24,22,0.08)] bg-white text-[14px] text-[#171717] placeholder:text-[#B9B6AE] outline-none focus:border-[#FFB43F]/60 focus:ring-2 focus:ring-[#FFB43F]/25 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0ada6] hover:text-[#5a5852] transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-[11px] font-medium text-[#8a877f] uppercase tracking-wider mb-1.5 ml-0.5">
            Confirm password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              placeholder="Repeat your password"
              required
              className="w-full h-11 px-4 pr-11 rounded-xl border border-[rgba(24,24,22,0.08)] bg-white text-[14px] text-[#171717] placeholder:text-[#B9B6AE] outline-none focus:border-[#FFB43F]/60 focus:ring-2 focus:ring-[#FFB43F]/25 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0ada6] hover:text-[#5a5852] transition-colors"
            >
              {showConfirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-[13px] px-3.5 py-2.5 rounded-xl bg-[#d4183d]/8 text-[#d4183d] animate-in fade-in duration-200 border border-[#d4183d]/10">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full h-11 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2 transition-all duration-200 mt-2",
            loading
              ? "bg-[#1A1815]/80 text-white cursor-wait"
              : "bg-[#1A1815] text-white hover:bg-black active:scale-[0.99] cursor-pointer"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Reset password
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex bg-[#fafaf8]">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] bg-[#1A1815] p-10 relative overflow-hidden">
        {/* Decorative lines */}
        <div className="absolute inset-0 opacity-[0.07]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px bg-white"
              style={{
                top: `${12 + i * 12}%`,
                left: "8%",
                width: `${35 + (i % 3) * 20}%`,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z"
                fill="white"
              />
              <path
                d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z"
                fill="#FFB43F"
              />
              <line x1="10.5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
              <line x1="10.5" y1="12.5" x2="14" y2="12.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h2
            className="text-white text-[28px] leading-[1.2] tracking-[-0.03em] mb-3"
            style={{ fontFamily: "'Degular', 'Inter', sans-serif", fontWeight: 600 }}
          >
            Your AI workspace
            <br />
            for everything.
          </h2>
          <p className="text-white/60 text-[14px] leading-relaxed">
            Docs, sheets, decks — all in one place.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#1A1815] flex items-center justify-center shadow-[0_2px_8px_rgba(24,24,22,0.18)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
                <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#FFB43F" />
                <line x1="10.5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
                <line x1="10.5" y1="12.5" x2="14" y2="12.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#95928E]" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
