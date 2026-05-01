"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Tiny client-side guard rendered at the top of the marketing landing.
 *
 * The marketing page is force-static for SEO + speed. Authenticated
 * visitors land here briefly (e.g. clicking the logo from their app,
 * or hitting bookmarked /), so we redirect them to /app on mount.
 *
 * The static page is still served instantly to unauthenticated visitors
 * (the common case). A fraction-of-a-second flash for authenticated
 * users is acceptable — they're not the primary audience for /.
 */
export function RedirectIfAuthenticated() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
    }
  }, [status, router]);

  return null;
}
