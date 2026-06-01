import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { checkRateLimit } from "@/lib/rateLimit";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: Request) {
  try {
    // IP-based rate limiting before any DB work (10 req/min)
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
    const rateLimit = checkRateLimit(`${ip}:forgot-password`, 10, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Always return success to prevent email enumeration
    const successResponse = Response.json({ success: true });

    // Look up user (case-insensitive)
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email))
      .limit(1);

    if (!user) {
      return successResponse;
    }

    // Rate limit: max 3 tokens in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTokens = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gte(passwordResetTokens.createdAt, oneHourAgo)
        )
      );

    if (recentTokens.length >= 3) {
      return Response.json(
        { error: "Too many reset requests. Please try again later." },
        { status: 429 }
      );
    }

    // Delete any existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    // Generate token and insert
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      id: nanoid(),
      userId: user.id,
      token,
      expiresAt,
    });

    // Send email via Resend
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Primy <noreply@primy.ai>",
      to: user.email,
      subject: "Reset your password — Primy",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#fafaf8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf8;padding:48px 24px;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;border:1px solid #e8e7e4;padding:40px;">
                  <tr>
                    <td>
                      <div style="width:36px;height:36px;border-radius:10px;background-color:#1A1815;margin-bottom:24px;"></div>
                      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1a1a2e;line-height:1.3;">Reset your password</h1>
                      <p style="margin:0 0 28px;font-size:14px;color:#6b6b80;line-height:1.6;">
                        We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
                      </p>
                      <a href="${resetUrl}" style="display:inline-block;background-color:#1A1815;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 28px;border-radius:12px;line-height:1;">
                        Reset password
                      </a>
                      <p style="margin:28px 0 0;font-size:12px;color:#95928E;line-height:1.5;">
                        If you didn't request this, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    return successResponse;
  } catch (error) {
    console.error("[API] POST /api/auth/forgot-password error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
