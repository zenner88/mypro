import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { daysUntil } from "@/lib/format";

const ACTIVE_STATUSES = ["APPROVED", "IN_PROGRESS", "ON_HOLD"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const project = await db.project.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        client: true,
        items: { orderBy: { sortOrder: "asc" } },
        timelines: { orderBy: { sortOrder: "asc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { terminNumber: "asc" } },
        invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        quotations: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) return Response.json({ error: "Project tidak ditemukan" }, { status: 404 });

    const total = Number(project.totalValue);
    const paid = project.payments
      .filter((p) => p.status !== "CANCELLED")
      .reduce((s, p) => s + Number(p.amountPaid), 0);
    const invoiced = project.invoices
      .filter((i) => i.status !== "CANCELLED")
      .reduce((s, i) => s + Number(i.total), 0);
    const dLeft = daysUntil(project.targetCompletionDate);

    return Response.json({
      ...project,
      stats: {
        totalValue: total,
        totalPaid: paid,
        outstanding: Math.max(0, total - paid),
        totalInvoiced: invoiced,
        isOverdue: ACTIVE_STATUSES.includes(project.status) && dLeft !== null && dLeft < 0,
        daysLeft: dLeft,
        tasksDone: project.tasks.filter((t) => t.status === "DONE").length,
        tasksTotal: project.tasks.length,
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
    const existing = await db.project.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Project tidak ditemukan" }, { status: 404 });

    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.clientId !== undefined) data.clientId = body.clientId;
    if (body.description !== undefined) data.description = body.description;
    if (body.projectType !== undefined) data.projectType = body.projectType;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.progress !== undefined) data.progress = Math.min(100, Math.max(0, Number(body.progress)));
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.targetCompletionDate !== undefined)
      data.targetCompletionDate = body.targetCompletionDate ? new Date(body.targetCompletionDate) : null;
    if (body.actualCompletionDate !== undefined)
      data.actualCompletionDate = body.actualCompletionDate ? new Date(body.actualCompletionDate) : null;
    if (body.totalValue !== undefined) data.totalValue = Number(body.totalValue) || 0;

    let statusChanged: string | null = null;
    if (body.status !== undefined && body.status !== existing.status) {
      data.status = body.status;
      statusChanged = body.status;
      if (body.status === "COMPLETED") {
        data.actualCompletionDate = body.actualCompletionDate
          ? new Date(body.actualCompletionDate)
          : new Date();
        data.progress = 100;
      }
    }

    const project = await db.project.update({ where: { id: params.id }, data });

    await logActivity({
      userId: session.user.id,
      action: statusChanged ? "STATUS_CHANGED" : "UPDATED",
      module: "PROJECT",
      recordId: project.id,
      description: statusChanged
        ? `Status project "${project.name}" berubah dari ${existing.status} ke ${statusChanged}`
        : `Project diperbarui: ${project.name}`,
    });

    return Response.json(project);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await db.project.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { _count: { select: { invoices: true } } },
    });
    if (!existing) return Response.json({ error: "Project tidak ditemukan" }, { status: 404 });

    const paidInvoices = await db.invoice.count({
      where: { projectId: params.id, deletedAt: null, amountPaid: { gt: 0 } },
    });
    if (paidInvoices > 0) {
      return Response.json(
        { error: "Project memiliki invoice dengan pembayaran — tidak dapat dihapus" },
        { status: 400 }
      );
    }

    await db.project.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    await logActivity({
      userId: session.user.id,
      action: "DELETED",
      module: "PROJECT",
      recordId: params.id,
      description: `Project dihapus: ${existing.name}`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
