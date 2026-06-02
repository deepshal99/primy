import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rateLimit";
import { validatePassword, isBreachedPassword } from "@/lib/authPolicy";

export async function POST(req: Request) {
  try {
    // IP-based rate limiting (10 req/min)
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
    const rateLimit = checkRateLimit(`${ip}:reset-password`, 10, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: { token?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { token, password } = body;

    if (!token) {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError || typeof password !== "string") {
      return Response.json({ error: pwError ?? "Password is required" }, { status: 400 });
    }
    if (await isBreachedPassword(password)) {
      return Response.json(
        { error: "This password has appeared in a data breach. Please choose a different one." },
        { status: 400 },
      );
    }

    // Look up valid, non-expired token
    const [resetToken] = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) {
      return Response.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(password, 12);

    // Bumping tokenVersion revokes every existing session for this user — the
    // whole point of a reset after a suspected takeover.
    await db
      .update(users)
      .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, resetToken.userId));

    // Delete ALL tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, resetToken.userId));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/auth/reset-password error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
