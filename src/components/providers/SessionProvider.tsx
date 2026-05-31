"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { DevAutoLogin } from "./DevAutoLogin";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <DevAutoLogin />
      {children}
    </NextAuthSessionProvider>
  );
}
