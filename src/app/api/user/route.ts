import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { effectivePlan, isOnGracePeriod } from "@/lib/billing";
import { getOrgPlanInput } from "@/lib/org/orgAccess";
import { validatePassword, isBreachedPassword } from "@/lib/authPolicy";
import { seedStarterWorkspace } from "@/lib/onboarding/seedStarter";

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

    // Fold in the org plan so company-paid members report as pro.
    // (isOnGracePeriod only inspects the personal plan/proUntil — org fields are ignored there.)
    const org = await getOrgPlanInput(user.id);
    const planInput = {
      plan: user.plan,
      proUntil: user.proUntil ?? null,
      orgPlan: org.orgPlan,
      orgProUntil: org.orgProUntil,
    };

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

    const { name, currentPassword, newPassword, hasOnboarded } = body;

    // Onboarding completion — accepts only `true`. We never reset the flag
    // back to false from this endpoint; that's a deliberate one-way switch.
    if (hasOnboarded !== undefined) {
      if (hasOnboarded !== true) {
        return Response.json(
          { error: "hasOnboarded can only be set to true" },
          { status: 400 }
        );
      }
      // Read the current flag so we seed the starter workspace exactly once,
      // on the false→true transition (a repeat PATCH must not re-seed).
      const [current] = await db
        .select({ hasOnboarded: users.hasOnboarded })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      await db
        .update(users)
        .set({ hasOnboarded: true })
        .where(eq(users.id, session.user.id));

      if (!current?.hasOnboarded) {
        await seedStarterWorkspace(session.user.id);
      }

      return Response.json({ success: true, hasOnboarded: true });
    }

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
      const pwError = validatePassword(newPassword);
      if (pwError) {
        return Response.json({ error: pwError }, { status: 400 });
      }
      if (await isBreachedPassword(String(newPassword))) {
        return Response.json(
          { error: "This password has appeared in a data breach. Please choose a different one." },
          { status: 400 },
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
      // Bump tokenVersion so a password change revokes ALL sessions (the secure
      // default — any compromised session is killed). The client signs out and
      // sends the user to log in again.
      await db
        .update(users)
        .set({ passwordHash: newHash, tokenVersion: sql`${users.tokenVersion} + 1` })
        .where(eq(users.id, session.user.id));

      return Response.json({ success: true });
    }

    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (error) {
    console.error("[API] PATCH /api/user error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
