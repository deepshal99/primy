"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import Link from "next/link";

/**
 * Unified auth — one page for sign in AND sign up (no mode toggle).
 *
 * Submit attempts sign-in first; if there's no account, it creates one with the
 * same email + password. So an existing user logs in and a new user signs up
 * through the identical form. (Passwordless email-code is wired in the backend
 * and will replace this once a sending domain is verified.)
 */
export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/app");
  }, [status, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFBF8]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFB43F]" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);

    // 1) Try to sign in to an existing account.
    let result = await signIn("credentials", {
      email: em,
      password,
      mode: "signin",
      redirect: false,
    });
    if (result?.ok) {
      window.location.href = "/app";
      return;
    }

    // 2) No existing account (or wrong password) → try to create one.
    result = await signIn("credentials", {
      email: em,
      password,
      name: "",
      mode: "signup",
      redirect: false,
    });
    setLoading(false);

    if (result?.ok) {
      window.location.href = "/onboarding";
      return;
    }
    // Both failed: wrong password on an existing account, or the new password
    // was too short. One clear message covers both without leaking which.
    setError("Couldn't sign you in. Check your password, or use 8+ characters to create a new account.");
  };

  const isDev = process.env.NODE_ENV !== "production";
  const handleDevSignIn = async () => {
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email: "admin@primy.local",
      password: "admin",
      mode: "signin",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Dev admin not found. Run `npm run dev:admin` to seed the local admin user.");
    } else if (result?.ok) {
      window.location.href = "/app";
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FCFBF8]">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] bg-[#1A1815] p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px bg-white"
              style={{ top: `${12 + i * 12}%`, left: "8%", width: `${35 + (i % 3) * 20}%` }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
              <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#FFB43F" />
              <line x1="10.5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
              <line x1="10.5" y1="12.5" x2="14" y2="12.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
        </div>

        <div className="relative z-10">
          <h2
            className="text-white text-[28px] leading-[1.2] tracking-[-0.03em] mb-3"
            style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600 }}
          >
            Your AI workspace
            <br />
            for everything.
          </h2>
          <p className="text-white/60 text-[14px] leading-relaxed">
            Docs, sheets, decks. All in one place.
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

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[22px] tracking-[-0.02em] text-[#1A1815]" style={{ fontWeight: 600 }}>
              Sign in to Primy
            </h1>
            <p className="mt-1 text-[13.5px] text-[#706E68]">
              New here? Just enter your email and a password, we&apos;ll create your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#706E68] uppercase tracking-wider mb-1.5 ml-0.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@email.com"
                required
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-[rgba(24,24,22,0.10)] bg-white text-[14px] text-[#1A1815] placeholder:text-[#B9B6AE] outline-none focus:border-[#FFB43F]/60 focus:ring-2 focus:ring-[#FFB43F]/25 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#706E68] uppercase tracking-wider mb-1.5 ml-0.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Your password"
                  required
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-[rgba(24,24,22,0.10)] bg-white text-[14px] text-[#1A1815] placeholder:text-[#B9B6AE] outline-none focus:border-[#FFB43F]/60 focus:ring-2 focus:ring-[#FFB43F]/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B9B6AE] hover:text-[#3B3A37] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-1">
              <Link href="/forgot-password" className="text-[12px] text-[#B9B6AE] hover:text-[#1A1815] transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="text-[13px] px-3.5 py-2.5 rounded-xl bg-[#d4183d]/8 text-[#d4183d] animate-in fade-in duration-200 border border-[#d4183d]/10">
                {error}
              </div>
            )}

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
                  Continue
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {isDev && (
            <div className="mt-6 pt-5 border-t border-dashed border-[rgba(24,24,22,0.12)]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[10.5px] uppercase tracking-wider text-[#B9B6AE] font-medium">
                  Local development
                </span>
                <span className="text-[10.5px] text-[#B9B6AE] font-mono">NODE_ENV=development</span>
              </div>
              <button
                type="button"
                onClick={handleDevSignIn}
                disabled={loading}
                className={cn(
                  "w-full h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 border",
                  loading
                    ? "bg-[#F7F7F4] text-[#B9B6AE] border-[rgba(24,24,22,0.10)] cursor-wait"
                    : "bg-white text-[#1A1815] border-[rgba(24,24,22,0.14)] hover:bg-[#F7F7F4] active:scale-[0.99] cursor-pointer"
                )}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    Sign in as admin (dev)
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
              <p className="text-[10.5px] text-center mt-2 text-[#B9B6AE]">
                <span className="font-mono">admin@primy.local</span> · seeded via{" "}
                <span className="font-mono">npm run dev:admin</span>
              </p>
            </div>
          )}

          <p className="text-[12px] text-center mt-8 text-[#B9B6AE]">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
