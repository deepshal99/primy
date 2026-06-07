"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShellV2 } from "@/components/shell/v2/AppShellV2";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { DEV_AUTH_BYPASS } from "@/components/providers/DevAutoLogin";
import { useAppStore } from "@/lib/store";

export default function AppHome() {
  const { status } = useSession();
  const router = useRouter();
  // Returning users have their workspaces hydrated from localStorage at store
  // init, so we can paint the shell immediately while the session revalidates
  // in the background instead of holding a full-screen loader through the
  // round trip. First-time / logged-out visitors (no cache) still see the
  // loader until auth resolves.
  const hasCachedWorkspaces = useAppStore((s) => s.projects.length > 0);

  useEffect(() => {
    // In dev bypass mode, DevAutoLogin signs us in instead of redirecting.
    if (status === "unauthenticated" && !DEV_AUTH_BYPASS) {
      router.push("/login");
    }
  }, [status, router]);

  // Logged-out users are never shown the app, even with stale local cache.
  if (status === "unauthenticated" && !DEV_AUTH_BYPASS) {
    return null;
  }

  // While auth is still resolving (or dev-bypass is signing in), only block
  // when we have nothing cached to render. With cached workspaces, drop
  // straight into the shell — the session confirms in the background.
  const authPending =
    status === "loading" || (status === "unauthenticated" && DEV_AUTH_BYPASS);
  if (authPending && !hasCachedWorkspaces) {
    return <LoadingScreen />;
  }

  return <AppShellV2 />;
}
