import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await db.client.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { tasks: true, documents: true } } },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) return Response.json({ error: "Client tidak ditemukan" }, { status: 404 });

    const invoiceAgg = await db.invoice.aggregate({
      where: { clientId: client.id, deletedAt: null, status: { not: "CANCELLED" } },
      _sum: { total: true, amountPaid: true },
    });

    const totalProjectValue = client.projects.reduce((s, p) => s + Number(p.totalValue), 0);
    const totalInvoiced = Number(invoiceAgg._sum.total ?? 0);
    const totalPaid = Number(invoiceAgg._sum.amountPaid ?? 0);

    return Response.json({
      ...client,
      stats: {
        totalProjects: client.projects.length,
        totalProjectValue,
        totalInvoiced,
        totalPaid,
        outstanding: Math.max(0, totalInvoiced - totalPaid),
      },
    });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await db.client.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Client tidak ditemukan" }, { status: 404 });

    const client = await db.client.update({
      where: { id: params.id },
      data: {
        companyName: body.companyName?.trim() ?? existing.companyName,
        contactPerson: body.contactPerson?.trim() ?? existing.contactPerson,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        whatsapp: body.whatsapp ?? existing.whatsapp,
        address: body.address ?? existing.address,
        npwp: body.npwp ?? existing.npwp,
        website: body.website ?? existing.website,
        notes: body.notes ?? existing.notes,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "CLIENT",
      recordId: client.id,
      description: `Client diperbarui: ${client.companyName}`,
    });

    return Response.json(client);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await db.client.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { _count: { select: { projects: true, invoices: true } } },
    });
    if (!existing) return Response.json({ error: "Client tidak ditemukan" }, { status: 404 });

    const activeProjects = await db.project.count({
      where: { clientId: params.id, deletedAt: null, status: { in: ["IN_PROGRESS", "APPROVED", "ON_HOLD"] } },
    });
    if (activeProjects > 0) {
      return Response.json(
        { error: "Tidak dapat menghapus client yang masih memiliki project aktif" },
        { status: 400 }
      );
    }

    await db.client.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    await logActivity({
      userId: session.user.id,
      action: "DELETED",
      module: "CLIENT",
      recordId: params.id,
      description: `Client dihapus: ${existing.companyName}`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
