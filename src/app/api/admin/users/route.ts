import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Hanya Admin yang dapat mengelola user." }, { status: 403 });
  }

  try {
    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        maxProjects: true,
        maxInvoices: true,
        createdAt: true,
        _count: {
          select: {
            projects: { where: { deletedAt: null } },
            invoices: { where: { deletedAt: null } },
            clients: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Hanya Admin yang dapat mengelola user." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, role, plan, maxProjects, maxInvoices } = body ?? {};
    if (!userId) {
      return NextResponse.json({ error: "User ID wajib diisi" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        role: role ?? targetUser.role,
        plan: plan ?? targetUser.plan,
        maxProjects: maxProjects !== undefined ? Number(maxProjects) : targetUser.maxProjects,
        maxInvoices: maxInvoices !== undefined ? Number(maxInvoices) : targetUser.maxInvoices,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "AUTH",
      recordId: userId,
      description: `User ${updated.email} diubah: Role=${updated.role}, Plan=${updated.plan}, maxProjects=${updated.maxProjects}, maxInvoices=${updated.maxInvoices}`,
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Hanya Admin yang dapat mengelola user." }, { status: 403 });
  }

  try {
    const sp = new URL(req.url).searchParams;
    const userId = sp.get("userId");
    if (!userId) return NextResponse.json({ error: "User ID wajib" }, { status: 400 });

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Tidak dapat menghapus akun Anda sendiri" }, { status: 400 });
    }

    await db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
