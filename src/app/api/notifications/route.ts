import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";

const ACTIVE = ["APPROVED", "IN_PROGRESS", "ON_HOLD"];

export async function GET() {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const items: { type: string; level: "warning" | "danger" | "info"; message: string; href?: string }[] = [];

    // Overdue invoices
    const overdueInvoices = await db.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { client: { select: { companyName: true } } },
      take: 10,
      orderBy: { dueDate: "asc" },
    });
    for (const inv of overdueInvoices) {
      items.push({
        type: "INVOICE",
        level: "danger",
        message: `Invoice ${inv.number} (${inv.client.companyName}) sudah jatuh tempo`,
        href: `/invoices/${inv.id}`,
      });
    }

    // Payments due soon (3 days) or overdue
    const duePayments = await db.payment.findMany({
      where: {
        status: { in: ["PENDING", "DUE", "PARTIALLY_PAID"] },
        dueDate: { lte: soon },
      },
      include: { project: { select: { name: true, code: true } } },
      take: 10,
      orderBy: { dueDate: "asc" },
    });
    for (const pay of duePayments) {
      const overdue = pay.dueDate && pay.dueDate < now;
      items.push({
        type: "PAYMENT",
        level: overdue ? "danger" : "warning",
        message: overdue
          ? `Termin ${pay.terminNumber} project ${pay.project.name} lewat jatuh tempo`
          : `Termin ${pay.terminNumber} project ${pay.project.name} jatuh tempo ≤3 hari`,
        href: `/projects/${pay.projectId}?tab=payments`,
      });
    }

    // Project deadlines within 3 days
    const deadlineProjects = await db.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ACTIVE },
        targetCompletionDate: { lte: soon, gte: now },
      },
      take: 10,
      orderBy: { targetCompletionDate: "asc" },
    });
    for (const prj of deadlineProjects) {
      const days = Math.ceil((prj.targetCompletionDate!.getTime() - now.getTime()) / 86400000);
      items.push({
        type: "DEADLINE",
        level: days <= 1 ? "danger" : "warning",
        message: `Project "${prj.name}" deadline ${days === 0 ? "hari ini" : `${days} hari lagi`}`,
        href: `/projects/${prj.id}`,
      });
    }

    // Overdue projects (deadline passed but still active)
    const overdueProjects = await db.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ACTIVE },
        targetCompletionDate: { lt: now },
      },
      take: 10,
      orderBy: { targetCompletionDate: "asc" },
    });
    for (const prj of overdueProjects) {
      items.push({
        type: "PROJECT",
        level: "danger",
        message: `Project "${prj.name}" overdue — sudah lewat target selesai`,
        href: `/projects/${prj.id}`,
      });
    }

    return Response.json({ items });
  } catch (err) {
    return handleServerError(err);
  }
}
