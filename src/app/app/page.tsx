"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShellV2 } from "@/components/shell/v2/AppShellV2";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { DEV_AUTH_BYPASS } from "@/components/providers/DevAutoLogin";

export default function AppHome() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // In dev bypass mode, DevAutoLogin signs us in instead of redirecting.
    if (status === "unauthenticated" && !DEV_AUTH_BYPASS) {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || (status === "unauthenticated" && DEV_AUTH_BYPASS)) {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <AppShellV2 />;
}
