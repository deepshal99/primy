import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
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
    if (!password || password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
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

    await db
      .update(users)
      .set({ passwordHash })
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
