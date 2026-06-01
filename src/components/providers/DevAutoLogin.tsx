"use client";

import { useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

/**
 * DEV ONLY. When NEXT_PUBLIC_DEV_AUTH_BYPASS=true and the visitor has no
 * session, silently signs in as the local dev admin (admin@primy.local).
 * This removes the login wall while testing. It is a real credentials
 * sign-in, so both the server `auth()` and client `useSession()` work
 * normally afterward — no other code needs to special-case it.
 *
 * The flag must never be set in production; the dev admin credentials are
 * well-known and the button/auto-login are dev affordances only.
 */
export const DEV_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export function DevAutoLogin() {
  const { status } = useSession();
  const tried = useRef(false);

  useEffect(() => {
    if (!DEV_AUTH_BYPASS) return;
    if (status === "unauthenticated" && !tried.current) {
      tried.current = true;
      void signIn("credentials", {
        email: "admin@primy.local",
        password: "admin",
        mode: "signin",
        redirect: false,
      });
    }
  }, [status]);

  return null;
}
