"use client";

/**
 * Onboarding — 3-step first-run flow gated by users.hasOnboarded.
 *
 * Step 1: Role multi-select (advisory only — seeds future personalization).
 * Step 2: 30-second explainer of the chat → artifact loop.
 * Step 3: Create the user's first project (title + description).
 *
 * Completion path:
 *   PATCH /api/user { hasOnboarded: true }
 *   → POST /api/projects (only on step 3 finish)
 *   → router.replace("/app?p=<id>")
 *
 * "Skip onboarding" is available on every step except during a network call.
 * Skipping flips hasOnboarded=true without creating a project.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageSquare,
  FileText,
  Table2,
  Presentation,
  Sparkles,
  Check,
  Rocket,
  Briefcase,
  Megaphone,
  GraduationCap,
  Settings as SettingsIcon,
  HelpCircle,
} from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/cn";

interface UserPayload {
  id: string;
  hasOnboarded: boolean;
}

const ROLE_OPTIONS = [
  { id: "founder", label: "Founder / Indie hacker", icon: Rocket },
  { id: "consultant", label: "Consultant / Freelancer", icon: Briefcase },
  { id: "marketer", label: "Marketer", icon: Megaphone },
  { id: "researcher", label: "Researcher / Student", icon: GraduationCap },
  { id: "operations", label: "Operations", icon: SettingsIcon },
  { id: "other", label: "Other", icon: HelpCircle },
] as const;

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();

  // Loading state of /api/user query
  const [userLoading, setUserLoading] = useState(true);
  const [user, setUser] = useState<UserPayload | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [roles, setRoles] = useState<Set<string>>(() => new Set());
  const [projectTitle, setProjectTitle] = useState("My first Drafta project");
  const [projectDescription, setProjectDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  // ── Auth gate ──
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // ── Load user; redirect away if already onboarded ──
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
        const data: UserPayload = await res.json();
        if (cancelled) return;
        setUser(data);
        if (data.hasOnboarded) {
          router.replace("/app");
          return;
        }
      } catch (err) {
        console.error("[onboarding] failed to load user:", err);
        if (!cancelled) setError("Couldn't load your account. Please refresh.");
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  // ── Helpers ──
  const goNext = useCallback(() => {
    setDirection("forward");
    setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as 1 | 2 | 3) : s));
  }, []);

  const goBack = useCallback(() => {
    setDirection("back");
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }, []);

  const toggleRole = useCallback((id: string) => {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const markOnboarded = useCallback(async () => {
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasOnboarded: true }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to complete onboarding: ${text || res.status}`);
    }
  }, []);

  const handleSkip = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await markOnboarded();
      router.replace("/app");
    } catch (err) {
      console.error("[onboarding] skip failed:", err);
      setError("Couldn't save. Please try again.");
      setBusy(false);
    }
  }, [busy, markOnboarded, router]);

  const handleCreateProject = useCallback(async () => {
    if (busy) return;
    const title = projectTitle.trim() || "My first Drafta project";
    setBusy(true);
    setError("");
    try {
      const id = nanoid();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          description: projectDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      await markOnboarded();
      router.replace(`/app?p=${id}`);
    } catch (err) {
      console.error("[onboarding] create project failed:", err);
      setError("Couldn't create project. Please try again.");
      setBusy(false);
    }
  }, [busy, projectTitle, projectDescription, markOnboarded, router]);

  // ── Render ──
  if (status === "loading" || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <Loader2 className="w-5 h-5 animate-spin text-[#ff4a00]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="text-[13px] text-[#737373]">{error || "Loading..."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf8]">
      {/* ── Header: progress + skip ── */}
      <header className="px-6 md:px-10 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#ff4a00] flex items-center justify-center shadow-[0_2px_8px_rgba(255,74,0,0.25)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
              <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#ff4a00" />
            </svg>
          </div>
          <span className="text-[13px] font-medium text-[#171717] tracking-tight">Drafta</span>
        </div>
        <ProgressDots step={step} total={TOTAL_STEPS} />
      </header>

      {/* ── Main: stage with sliding step ── */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[640px] py-12">
          <StepStage step={step} direction={direction}>
            {step === 1 && (
              <Step1Welcome
                roles={roles}
                onToggle={toggleRole}
                onContinue={goNext}
              />
            )}
            {step === 2 && <Step2Demo onContinue={goNext} onBack={goBack} />}
            {step === 3 && (
              <Step3FirstProject
                title={projectTitle}
                description={projectDescription}
                onTitleChange={setProjectTitle}
                onDescriptionChange={setProjectDescription}
                onCreate={handleCreateProject}
                onBack={goBack}
                busy={busy}
              />
            )}
          </StepStage>

          {error && (
            <div
              role="alert"
              className="mt-6 text-[13px] px-3.5 py-2.5 rounded-[8px] bg-[#eb3424]/8 text-[#eb3424] border border-[#eb3424]/12 text-center"
            >
              {error}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer: skip ── */}
      <footer className="px-6 md:px-10 py-6 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className={cn(
            "text-[13px] px-3 py-1.5 rounded-[6px] transition-all duration-200",
            "text-[#737373] hover:text-[#171717] hover:bg-[rgba(0,0,0,0.04)]",
            "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          )}
          aria-label="Skip onboarding"
        >
          Skip onboarding
        </button>
      </footer>
    </div>
  );
}

// ── Progress dots ─────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const isActive = n === step;
        const isComplete = n < step;
        return (
          <span
            key={n}
            className={cn(
              "block rounded-full transition-all ease-[cubic-bezier(0.16,1,0.3,1)] duration-200",
              isActive ? "w-8 h-2" : "w-2 h-2"
            )}
            style={{
              backgroundColor: isActive
                ? "#ff4a00"
                : isComplete
                ? "rgba(255,74,0,0.45)"
                : "rgba(0,0,0,0.1)",
            }}
            aria-hidden="true"
          />
        );
      })}
      <span className="ml-2 text-[12px] text-[#737373] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
        Step {step} of {total}
      </span>
    </div>
  );
}

// ── Step container with slide animation ────────────────────────

function StepStage({
  step,
  direction,
  children,
}: {
  step: number;
  direction: "forward" | "back";
  children: React.ReactNode;
}) {
  // Re-mount on step change so the spring animation replays.
  const animClass = useMemo(
    () =>
      direction === "forward"
        ? "animate-step-in-right"
        : "animate-step-in-left",
    [direction]
  );
  return (
    <div key={step} className={animClass}>
      {children}
      <style jsx>{`
        @keyframes stepInRight {
          0% { opacity: 0; transform: translateX(16px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes stepInLeft {
          0% { opacity: 0; transform: translateX(-16px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        :global(.animate-step-in-right) {
          animation: stepInRight 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        :global(.animate-step-in-left) {
          animation: stepInLeft 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
}

// ── Step 1: Welcome + role nudge ───────────────────────────────

function Step1Welcome({
  roles,
  onToggle,
  onContinue,
}: {
  roles: Set<string>;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <section aria-labelledby="step1-title">
      <div className="text-center mb-10">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#ff4a00] font-medium mb-3">
          Welcome to Drafta
        </p>
        <h1
          id="step1-title"
          className="text-[32px] leading-[1.15] tracking-tight text-[#171717] font-medium"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500 }}
        >
          What do you do?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#525252] max-w-[460px] mx-auto">
          Pick anything that fits — we use this later to seed examples that match your work. Optional.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-10">
        {ROLE_OPTIONS.map(({ id, label, icon: Icon }) => {
          const selected = roles.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-3.5 rounded-[8px]",
                "border bg-white text-left transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer",
                selected
                  ? "border-[#ff4a00] shadow-[0_0_0_1px_#ff4a00,0_2px_8px_rgba(255,74,0,0.12)]"
                  : "border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.16)]"
              )}
              aria-pressed={selected}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-[6px] transition-colors",
                  selected ? "bg-[rgba(255,74,0,0.1)]" : "bg-[rgba(0,0,0,0.04)]"
                )}
              >
                <Icon
                  className={cn("w-4 h-4 transition-colors", selected ? "text-[#ff4a00]" : "text-[#525252]")}
                  strokeWidth={1.75}
                />
              </span>
              <span className="text-[14px] font-medium text-[#171717] flex-1">{label}</span>
              {selected && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ff4a00] animate-fade-in-soft">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center">
        <PrimaryButton onClick={onContinue}>
          Continue
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </div>
    </section>
  );
}

// ── Step 2: 30-second demo ─────────────────────────────────────

function Step2Demo({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <section aria-labelledby="step2-title">
      <div className="text-center mb-10">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#ff4a00] font-medium mb-3">
          How it works
        </p>
        <h1
          id="step2-title"
          className="text-[32px] leading-[1.15] tracking-tight text-[#171717] font-medium"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500 }}
        >
          Chat. Get a doc, sheet, or deck.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#525252] max-w-[460px] mx-auto">
          Type what you need. Drafta turns it into the right artifact — and remembers everything for next time.
        </p>
      </div>

      <DemoCard />

      <div className="mt-10 flex items-center justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </GhostButton>
        <PrimaryButton onClick={onContinue}>
          Got it
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </div>
    </section>
  );
}

function DemoCard() {
  return (
    <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Faux chat row */}
      <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-start gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[rgba(0,0,0,0.04)] flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-[#737373]" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#a3a3a3] font-medium mb-1">You</div>
          <div className="text-[14px] text-[#171717] leading-relaxed">
            <TypingLine text='"Make me a one-page proposal for Acme Corp redesign."' />
          </div>
        </div>
      </div>

      {/* Faux assistant row */}
      <div className="px-5 py-4 flex items-start gap-3 bg-[#fafaf8]">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[rgba(255,74,0,0.1)] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#ff4a00]" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#a3a3a3] font-medium mb-2">Drafta</div>
          <p className="text-[14px] text-[#525252] leading-relaxed mb-3">
            On it. Building a proposal doc with scope, timeline, and pricing.
          </p>
          <div className="flex flex-wrap gap-2">
            <ArtifactChip
              icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}
              label="Acme Proposal"
              color="#2a6dfb"
              bg="rgba(42,109,251,0.08)"
              delay={0}
            />
            <ArtifactChip
              icon={<Table2 className="w-3.5 h-3.5" strokeWidth={1.75} />}
              label="Pricing Tiers"
              color="#42c366"
              bg="rgba(66,195,102,0.1)"
              delay={120}
            />
            <ArtifactChip
              icon={<Presentation className="w-3.5 h-3.5" strokeWidth={1.75} />}
              label="Pitch Deck"
              color="#fa5d19"
              bg="rgba(250,93,25,0.1)"
              delay={240}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactChip({
  icon,
  label,
  color,
  bg,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  delay: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium"
      style={{
        color,
        backgroundColor: bg,
        animation: `fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}
    >
      <span style={{ color }}>{icon}</span>
      {label}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </span>
  );
}

function TypingLine({ text }: { text: string }) {
  return (
    <span className="relative inline-block">
      <span>{text}</span>
      <span
        aria-hidden
        className="inline-block w-[2px] h-[14px] ml-[1px] bg-[#171717] align-middle animate-pulse"
      />
    </span>
  );
}

// ── Step 3: First project ──────────────────────────────────────

function Step3FirstProject({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onCreate,
  onBack,
  busy,
}: {
  title: string;
  description: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCreate: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !busy) {
      e.preventDefault();
      onCreate();
    }
  };

  return (
    <section aria-labelledby="step3-title">
      <div className="text-center mb-10">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#ff4a00] font-medium mb-3">
          Last step
        </p>
        <h1
          id="step3-title"
          className="text-[32px] leading-[1.15] tracking-tight text-[#171717] font-medium"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500 }}
        >
          Let&apos;s create your first project.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#525252] max-w-[460px] mx-auto">
          A project is your canvas — chat history, docs, sheets, and decks all live together.
        </p>
      </div>

      <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <label className="block">
          <span className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1.5">
            Project name
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="My first Drafta project"
            disabled={busy}
            maxLength={120}
            className="w-full h-11 px-3.5 rounded-[6px] border border-[rgba(0,0,0,0.08)] bg-white text-[14px] text-[#171717] placeholder:text-[#a3a3a3] outline-none focus:border-[rgba(255,74,0,0.4)] focus:ring-2 focus:ring-[rgba(255,74,0,0.1)] transition-all disabled:opacity-60"
            autoFocus
          />
        </label>

        <label className="block mt-4">
          <span className="block text-[11px] font-medium text-[#737373] uppercase tracking-wider mb-1.5">
            What's it about? <span className="text-[#a3a3a3] normal-case tracking-normal">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="One line — keeps the AI on track"
            disabled={busy}
            rows={2}
            maxLength={280}
            className="w-full px-3.5 py-2.5 rounded-[6px] border border-[rgba(0,0,0,0.08)] bg-white text-[14px] text-[#171717] placeholder:text-[#a3a3a3] outline-none focus:border-[rgba(255,74,0,0.4)] focus:ring-2 focus:ring-[rgba(255,74,0,0.1)] transition-all resize-none disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <GhostButton onClick={onBack} disabled={busy}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </GhostButton>
        <PrimaryButton onClick={onCreate} loading={busy}>
          {busy ? "Creating..." : "Create project"}
          {!busy && <ArrowRight className="w-4 h-4" />}
        </PrimaryButton>
      </div>
    </section>
  );
}

// ── Buttons ────────────────────────────────────────────────────

function PrimaryButton({
  onClick,
  children,
  loading = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 h-11 px-5 rounded-[6px] text-[14px] font-medium",
        "bg-[#ff4a00] text-white shadow-[0_2px_8px_rgba(255,74,0,0.25)]",
        "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:bg-[#e54400] hover:shadow-[0_4px_14px_rgba(255,74,0,0.32)] active:scale-[0.98]",
        "disabled:opacity-70 disabled:cursor-wait cursor-pointer"
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 h-11 px-4 rounded-[6px] text-[14px] font-medium",
        "text-[#525252] bg-transparent",
        "transition-all duration-150 hover:text-[#171717] hover:bg-[rgba(0,0,0,0.04)]",
        "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      )}
    >
      {children}
    </button>
  );
}
