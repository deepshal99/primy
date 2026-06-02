"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AppShellV2 } from "@/components/shell/v2/AppShellV2";
import { useShellV2 } from "@/lib/useShellV2";
import { DEV_AUTH_BYPASS } from "@/components/providers/DevAutoLogin";

export default function AppHome() {
  const { status } = useSession();
  const router = useRouter();
  const shellV2 = useShellV2();

  useEffect(() => {
    // In dev bypass mode, DevAutoLogin signs us in instead of redirecting.
    if (status === "unauthenticated" && !DEV_AUTH_BYPASS) {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || (status === "unauthenticated" && DEV_AUTH_BYPASS)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* Animated doc lines — content being created */}
          <div className="w-[52px] h-[52px] rounded-2xl bg-secondary border border-border flex flex-col items-start justify-center gap-[5px] px-3">
            <div className="content-loader-line bg-[var(--accent-amber)]/60" style={{ width: "80%" }} />
            <div className="content-loader-line bg-[var(--accent-amber)]/40" style={{ width: "65%" }} />
            <div className="content-loader-line bg-[var(--accent-amber)]/30" style={{ width: "90%" }} />
            <div className="content-loader-line bg-[var(--accent-amber)]/20" style={{ width: "50%" }} />
            <div className="content-loader-line bg-[var(--accent-amber)]/15" style={{ width: "72%" }} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            Loading Primy...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return shellV2 ? <AppShellV2 /> : <AppShell />;
}
