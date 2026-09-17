import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";

export async function PUT(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.email !== undefined) data.email = String(body.email).toLowerCase().trim();
    if (body.phone !== undefined) data.phone = body.phone;

    const user = await db.user.update({ where: { id: session.user.id }, data });
    return Response.json({ id: user.id, name: user.name, email: user.email, phone: user.phone });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest) {
  // Change password
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body ?? {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return Response.json({ error: "Password baru minimal 8 karakter" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) return Response.json({ error: "User tidak ditemukan" }, { status: 404 });

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) return Response.json({ error: "Password saat ini salah" }, { status: 400 });

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(String(newPassword), 12) },
    });

    await logActivity({
      userId: user.id,
      action: "UPDATED",
      module: "AUTH",
      recordId: user.id,
      description: "Password diubah",
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
