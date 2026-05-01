import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { effectivePlan, isOnGracePeriod } from "@/lib/billing";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        hasOnboarded: users.hasOnboarded,
        plan: users.plan,
        proUntil: users.proUntil,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const planInput = { plan: user.plan, proUntil: user.proUntil ?? null };

    return Response.json({
      ...user,
      effectivePlan: effectivePlan(planInput),
      isOnGracePeriod: isOnGracePeriod(planInput),
    });
  } catch (error) {
    console.error("[API] GET /api/user error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, currentPassword, newPassword } = body;

    // Name update
    if (name !== undefined) {
      if (typeof name !== "string") {
        return Response.json({ error: "name must be a string" }, { status: 400 });
      }
      const trimmed = name.trim();
      if (!trimmed) {
        return Response.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      await db
        .update(users)
        .set({ name: trimmed })
        .where(eq(users.id, session.user.id));

      return Response.json({ success: true, name: trimmed });
    }

    // Password change
    if (currentPassword && newPassword) {
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return Response.json(
          { error: "New password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      const match = await bcrypt.compare(String(currentPassword), user.passwordHash);
      if (!match) {
        return Response.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, session.user.id));

      return Response.json({ success: true });
    }

    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (error) {
    console.error("[API] PATCH /api/user error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
