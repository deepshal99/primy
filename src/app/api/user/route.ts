import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
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
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, currentPassword, newPassword } = body;

  // Name update
  if (name !== undefined) {
    const trimmed = (name as string).trim();
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
    if ((newPassword as string).length < 6) {
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

    const match = await bcrypt.compare(currentPassword as string, user.passwordHash);
    if (!match) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword as string, 12);
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, session.user.id));

    return Response.json({ success: true });
  }

  return Response.json({ error: "No valid fields to update" }, { status: 400 });
}
