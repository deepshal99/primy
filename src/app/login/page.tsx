"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

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
        setError("Email already registered. Try signing in.");
      } else if (msg.includes("No account found")) {
        setError("No account found. Sign up first.");
      } else if (msg.includes("Incorrect password")) {
        setError("Incorrect password.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } else if (result?.ok) {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fafaf8]">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] bg-[#ff4a00] p-10 relative overflow-hidden">
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
                fill="#ff4a00"
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
            Docs, sheets, diagrams, decks — all in one place.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#ff4a00] flex items-center justify-center shadow-[0_2px_8px_rgba(255,74,0,0.25)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
                <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#ff4a00" />
                <line x1="10.5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
                <line x1="10.5" y1="12.5" x2="14" y2="12.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Mode toggle — clean tab style */}
          <div className="flex bg-[#f0eee9] rounded-xl p-1 mb-8">
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={cn(
                "flex-1 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200",
                mode === "signup"
                  ? "bg-white text-[#1a1a2e] shadow-sm"
                  : "text-[#8a877f] hover:text-[#5a5852]"
              )}
            >
              Sign up
            </button>
            <button
              onClick={() => { setMode("signin"); setError(""); }}
              className={cn(
                "flex-1 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200",
                mode === "signin"
                  ? "bg-white text-[#1a1a2e] shadow-sm"
                  : "text-[#8a877f] hover:text-[#5a5852]"
              )}
            >
              Sign in
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name — signup only */}
            {mode === "signup" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="block text-[11px] font-medium text-[#8a877f] uppercase tracking-wider mb-1.5 ml-0.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-11 px-4 rounded-xl border border-[#e8e7e4] bg-white text-[14px] text-[#1a1a2e] placeholder:text-[#c0bdb8] outline-none focus:border-[#ff4a00]/40 focus:ring-2 focus:ring-[#ff4a00]/10 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] font-medium text-[#8a877f] uppercase tracking-wider mb-1.5 ml-0.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@email.com"
                required
                className="w-full h-11 px-4 rounded-xl border border-[#e8e7e4] bg-white text-[14px] text-[#1a1a2e] placeholder:text-[#c0bdb8] outline-none focus:border-[#ff4a00]/40 focus:ring-2 focus:ring-[#ff4a00]/10 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium text-[#8a877f] uppercase tracking-wider mb-1.5 ml-0.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                  required
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-[#e8e7e4] bg-white text-[14px] text-[#1a1a2e] placeholder:text-[#c0bdb8] outline-none focus:border-[#ff4a00]/40 focus:ring-2 focus:ring-[#ff4a00]/10 transition-all"
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
                  ? "bg-[#ff4a00]/80 text-white cursor-wait"
                  : "bg-[#ff4a00] text-white hover:bg-[#e54400] active:scale-[0.99] cursor-pointer"
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-[12px] text-center mt-8 text-[#b0ada6]">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
