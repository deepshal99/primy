import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { validatePassword, isDevOnlyEmail } from "@/lib/authPolicy";
import { emailKey, ipKey, lockedSeconds, recordFailure, clearAttempts, THRESHOLDS } from "@/lib/authThrottle";

function getClientIp(request: Request | undefined): string {
  const h = request?.headers;
  // Prefer the platform-set real IP; x-forwarded-for's leftmost can be spoofed.
  return (
    h?.get("x-real-ip") ||
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// A real bcrypt hash compared against when no user is found, so a failed login
// takes the same time whether or not the email exists (defeats timing-based
// account enumeration). The plaintext is irrelevant — it never matches.
const DUMMY_HASH = bcrypt.hashSync("primy-timing-equalizer-not-a-secret", 12);

// Generic message for ALL sign-in failures — never reveal whether the email
// exists or whether it was the password that was wrong.
const GENERIC_LOGIN_ERROR = "Invalid email or password";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        mode: { label: "Mode", type: "text" }, // "signin" or "signup"
      },
      async authorize(credentials, request) {
        const email = (credentials?.email as string)?.trim().toLowerCase();
        const password = credentials?.password as string;
        const name = (credentials?.name as string)?.trim();
        const mode = credentials?.mode as string;

        if (!email || !password) return null;

        // Dev-only accounts (admin@*.local) must never authenticate in prod,
        // even if such a row exists in the database. Gating elsewhere is
        // client-side only; this is the server-side backstop.
        if (process.env.NODE_ENV === "production" && isDevOnlyEmail(email)) {
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        if (mode === "signup") {
          const pwError = validatePassword(password);
          if (pwError) throw new Error(pwError);

          // Check if email already exists. (Sign-up necessarily reveals whether
          // an email is taken — that's an accepted UX tradeoff, mitigated by
          // rate limiting; login below stays non-enumerable.)
          const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (existing.length > 0) {
            throw new Error("Email already registered");
          }

          const passwordHash = await bcrypt.hash(password, 12);
          const [newUser] = await db
            .insert(users)
            .values({
              id: nanoid(),
              name: name || email.split("@")[0],
              email,
              passwordHash,
            })
            .returning();

          return { id: newUser.id, name: newUser.name, email: newUser.email };
        } else {
          // Local dev convenience: the dev-only admin (admin@*.local) bypasses
          // the brute-force throttle so repeated auto-logins / hot reloads never
          // lock the developer out. Gated to non-production AND dev-only emails;
          // the production backstop above already blocks these accounts in prod,
          // so real users always go through the full throttle below.
          const devBypass =
            process.env.NODE_ENV !== "production" && isDevOnlyEmail(email);

          // Brute-force / credential-stuffing throttle (durable, per-email AND
          // per-IP). Checked BEFORE any work so a locked account/IP is cheap.
          const eKey = emailKey(email);
          const iKey = ipKey(getClientIp(request));
          if (!devBypass) {
            const lock = Math.max(await lockedSeconds(eKey), await lockedSeconds(iKey));
            if (lock > 0) {
              throw new Error(`Too many attempts. Try again in ${Math.ceil(lock / 60)} min.`);
            }
          }

          // Always run a bcrypt compare (against a dummy hash when the user is
          // absent) and return ONE generic error, so neither the message nor
          // the timing reveals whether the account exists.
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          const hash = user?.passwordHash ?? DUMMY_HASH;
          const passwordMatch = await bcrypt.compare(password, hash);
          if (!user || !passwordMatch) {
            await recordFailure(eKey, THRESHOLDS.EMAIL_THRESHOLD);
            await recordFailure(iKey, THRESHOLDS.IP_THRESHOLD);
            throw new Error(GENERIC_LOGIN_ERROR);
          }
          await clearAttempts(eKey);
          await clearAttempts(iKey);
          return { id: user.id, name: user.name, email: user.email };
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // The JWT now carries plan + proUntil so client-side reads (e.g. plan
    // badge in the header) don't require a /api/user round-trip on every
    // navigation. NOTE: this is purely a client-side optimization. Server
    // enforcement in withPlanLimit still re-reads the users row each
    // request — JWT can be stale up to a session refresh, so the DB
    // remains the source of truth for billing decisions. We accept that
    // trade-off for now; once gateway webhooks land and refresh on
    // subscription events, withPlanLimit could be optimized to read from
    // the session directly.
    async jwt({ token, user, trigger }) {
      // Initial sign-in: mint the token with id + current plan + tokenVersion.
      if (user) {
        const [dbUser] = await db
          .select({ name: users.name, plan: users.plan, proUntil: users.proUntil, tokenVersion: users.tokenVersion })
          .from(users)
          .where(eq(users.id, user.id as string))
          .limit(1);
        token.id = user.id;
        token.name = dbUser?.name ?? (user.name as string);
        token.plan = dbUser?.plan;
        token.proUntil = dbUser?.proUntil ? dbUser.proUntil.toISOString() : null;
        token.tv = dbUser?.tokenVersion ?? 0;
        token.tvCheckedAt = Date.now();
        return token;
      }

      // Every subsequent request: re-validate against the DB on a short cadence
      // (not every call, to bound DB load). This is what makes a password reset
      // / "log out everywhere" invalidate stolen tokens — within ~30s — and
      // keeps plan/proUntil fresh. Force a check when the client calls update().
      const REVALIDATE_MS = 30_000;
      const lastChecked = typeof token.tvCheckedAt === "number" ? token.tvCheckedAt : 0;
      const stale = trigger === "update" || Date.now() - lastChecked > REVALIDATE_MS;
      if (token.id && stale) {
        const [dbUser] = await db
          .select({ name: users.name, plan: users.plan, proUntil: users.proUntil, tokenVersion: users.tokenVersion })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        // User deleted, or token version bumped → revoke by stripping identity.
        if (!dbUser || dbUser.tokenVersion !== token.tv) {
          return {};
        }
        token.name = dbUser.name;
        token.plan = dbUser.plan;
        token.proUntil = dbUser.proUntil ? dbUser.proUntil.toISOString() : null;
        token.tvCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.plan = token.plan as string | undefined;
        session.user.proUntil = token.proUntil as string | null | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    // Was the 30-day default — a stolen JWT is non-revocable until it expires,
    // so cap the window. Refreshes daily on activity. (Full revocation on
    // password reset is tracked via tokenVersion in the hardening plan.)
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // refresh once per day
  },
  secret: process.env.NEXTAUTH_SECRET!,
});
