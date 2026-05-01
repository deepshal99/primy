import type { DefaultSession } from "next-auth";

/**
 * Type augmentation for NextAuth v5.
 *
 * The JWT carries (plan, proUntil) so the client can render plan badges
 * and gating UI without an extra /api/user round-trip. Server-side
 * enforcement still re-reads the users row in withPlanLimit — the JWT
 * may be stale up to a session refresh, so it is not the source of
 * truth for billing decisions.
 */

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      plan?: string;
      proUntil?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: string;
    proUntil?: string | null;
  }
}
