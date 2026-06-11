import { db } from "@/db";
import { emailCodes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rateLimit";
import { isSignupAllowed } from "@/lib/authPolicy";
import { sendLoginCode } from "@/lib/email/mailer";

/**
 * POST /api/auth/request-code — passwordless login: email a 6-digit code.
 *
 * Generates a code, stores it bcrypt-hashed (10-min expiry, one active code per
 * email via PK upsert), and emails it. Rate-limited per IP and per email.
 * Always returns success (no account enumeration). The code is verified by the
 * "email-code" auth provider in src/lib/auth.ts.
 */

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit(`${ip}:request-code`, 8, 60_000);
    if (!ipLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    // Per-email throttle (3/min) on top of the IP limit.
    const emailLimit = checkRateLimit(`email:${email}:request-code`, 3, 60_000);
    if (!emailLimit.allowed) {
      return Response.json(
        { error: "Code already sent. Check your inbox, or wait a moment." },
        { status: 429 }
      );
    }

    // Closed access: only send a code to an allowlisted email or an existing
    // account. For anyone else, return success anyway (no enumeration) but do
    // nothing — they can never create an account, so a code would be useless.
    if (!isSignupAllowed(email)) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!existing) return Response.json({ success: true });
    }

    // 6-digit numeric code (000000–999999), zero-padded.
    const n = Math.floor(Math.random() * 1_000_000);
    const code = String(n).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // One active code per email — upsert replaces any prior code + resets attempts.
    await db
      .insert(emailCodes)
      .values({ email, codeHash, expiresAt, attempts: 0 })
      .onConflictDoUpdate({
        target: emailCodes.email,
        set: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
      });

    // A mailer failure is infrastructure, not account state — it hits every
    // email the same way, so surfacing it leaks nothing. Silently returning
    // success here strands the user on "check your inbox" forever.
    try {
      await sendLoginCode(email, code);
    } catch (mailErr) {
      console.error("[request-code] email send failed:", mailErr instanceof Error ? mailErr.message : mailErr);
      return Response.json(
        { error: "We couldn't send the email right now. Please try again in a moment." },
        { status: 503 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/auth/request-code error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
