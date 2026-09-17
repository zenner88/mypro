import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";

export async function GET() {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();

    const pWhere: any = { deletedAt: null };
    const invWhere: any = { deletedAt: null };
    if (session.user.role !== "ADMIN") {
      pWhere.userId = session.user.id;
      invWhere.userId = session.user.id;
    }

    const [
      totalProjects,
      statusGroups,
      projectAgg,
      invoiceAgg,
      activeProjects,
      recentActivities,
      upcomingPayments,
      nearestDeadlines,
    ] = await Promise.all([
      db.project.count({ where: pWhere }),
      db.project.groupBy({ by: ["status"], where: pWhere, _count: true }),
      db.project.aggregate({ where: { ...pWhere, status: { not: "CANCELLED" } }, _sum: { totalValue: true } }),
      db.invoice.aggregate({
        where: { ...invWhere, status: { not: "CANCELLED" } },
        _sum: { total: true, amountPaid: true },
        _count: true,
      }),
      db.project.findMany({
        where: { ...pWhere, status: { in: ["APPROVED", "IN_PROGRESS", "ON_HOLD"] } },
        include: { client: { select: { companyName: true } } },
        orderBy: { targetCompletionDate: "asc" },
        take: 6,
      }),
      db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } } } }),
      db.payment.findMany({
        where: { status: { in: ["PENDING", "DUE", "OVERDUE", "PARTIALLY_PAID"] }, project: pWhere },
        include: { project: { select: { name: true, code: true, clientId: true } } },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      db.project.findMany({
        where: { ...pWhere, status: { in: ["APPROVED", "IN_PROGRESS"] }, targetCompletionDate: { not: null } },
        orderBy: { targetCompletionDate: "asc" },
        take: 5,
        select: { id: true, name: true, code: true, status: true, progress: true, targetCompletionDate: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of statusGroups) statusMap[g.status] = g._count;

    const totalValue = Number(projectAgg._sum.totalValue ?? 0);
    const totalInvoiced = Number(invoiceAgg._sum.total ?? 0);
    const totalPaid = Number(invoiceAgg._sum.amountPaid ?? 0);
    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    const unpaidInvoices = await db.invoice.count({
      where: { ...invWhere, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
    });
    const overdueInvoices = await db.invoice.count({
      where: { ...invWhere, status: "OVERDUE" },
    });
    const overdueProjects = await db.project.count({
      where: {
        ...pWhere,
        status: { in: ["APPROVED", "IN_PROGRESS", "ON_HOLD"] },
        targetCompletionDate: { lt: now },
      },
    });

    // Monthly received payments (last 6 months) for simple chart
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const receipts = await db.receipt.findMany({
      where: { paidDate: { gte: sixMonthsAgo } },
      select: { amount: true, paidDate: true },
    });
    const monthly: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amount = receipts
        .filter((r) => {
          const rd = new Date(r.paidDate);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        })
        .reduce((s, r) => s + Number(r.amount), 0);
      monthly.push({ month: key, amount });
    }

    return Response.json({
      project: {
        total: totalProjects,
        active: (statusMap["APPROVED"] ?? 0) + (statusMap["IN_PROGRESS"] ?? 0) + (statusMap["ON_HOLD"] ?? 0),
        completed: statusMap["COMPLETED"] ?? 0,
        pending: (statusMap["DRAFT"] ?? 0) + (statusMap["PROPOSAL"] ?? 0) + (statusMap["NEGOTIATION"] ?? 0),
        cancelled: statusMap["CANCELLED"] ?? 0,
        overdue: overdueProjects,
        byStatus: statusMap,
      },
      financial: {
        totalProjectValue: totalValue,
        totalInvoiced,
        totalPaid,
        outstanding,
        totalInvoices: invoiceAgg._count,
        unpaidInvoices,
        overdueInvoices,
      },
      monthlyReceipts: monthly,
      activeProjects: activeProjects.map((p) => ({
        id: p.id,
        code: p.name ? p.code : p.code,
        name: p.name,
        client: p.client.companyName,
        status: p.status,
        progress: p.progress,
        targetCompletionDate: p.targetCompletionDate,
      })),
      upcomingPayments: upcomingPayments.map((pay) => ({
        id: pay.id,
        projectId: pay.projectId,
        projectName: pay.project.name,
        terminNumber: pay.terminNumber,
        amount: Number(pay.amount),
        amountPaid: Number(pay.amountPaid),
        dueDate: pay.dueDate,
        status: pay.status,
      })),
      nearestDeadlines,
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        description: a.description,
        module: a.module,
        action: a.action,
        user: a.user?.name ?? "System",
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
