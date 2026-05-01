import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        mode: { label: "Mode", type: "text" }, // "signin" or "signup"
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.trim().toLowerCase();
        const password = credentials?.password as string;
        const name = (credentials?.name as string)?.trim();
        const mode = credentials?.mode as string;

        if (!email || !password) return null;

        if (mode === "signup") {
          // Check if email already exists
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (existing.length > 0) {
            throw new Error("Email already registered");
          }
          if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
          }

          // Hash password and create user
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
          // Sign in
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (!user) {
            throw new Error("No account found with this email");
          }
          const passwordMatch = await bcrypt.compare(password, user.passwordHash);
          if (!passwordMatch) {
            throw new Error("Incorrect password");
          }
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
      if (user) {
        token.id = user.id;
        token.name = user.name;
        // Fetch plan + proUntil on initial sign-in so the token carries
        // them from the start.
        const [dbUser] = await db
          .select({ plan: users.plan, proUntil: users.proUntil })
          .from(users)
          .where(eq(users.id, user.id as string))
          .limit(1);
        if (dbUser) {
          token.plan = dbUser.plan;
          token.proUntil = dbUser.proUntil ? dbUser.proUntil.toISOString() : null;
        }
      }
      // When client calls update() after name change (or plan upgrade),
      // refresh from DB so the session reflects the new state.
      if (trigger === "update" && token.id) {
        const [dbUser] = await db
          .select({ name: users.name, plan: users.plan, proUntil: users.proUntil })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        if (dbUser) {
          token.name = dbUser.name;
          token.plan = dbUser.plan;
          token.proUntil = dbUser.proUntil ? dbUser.proUntil.toISOString() : null;
        }
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
  },
  secret: process.env.NEXTAUTH_SECRET!,
});
