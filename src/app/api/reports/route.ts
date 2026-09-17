import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { toCsv } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") ?? "financial";
    const from = sp.get("from") ? new Date(sp.get("from")!) : null;
    const to = sp.get("to") ? new Date(sp.get("to") + "T23:59:59") : null;
    const clientId = sp.get("clientId") ?? "";
    const projectId = sp.get("projectId") ?? "";
    const status = sp.get("status") ?? "";
    const format = sp.get("format") ?? "json";

    const dateWhere: any = {};
    if (from) dateWhere.gte = from;
    if (to) dateWhere.lte = to;

    const baseProject: any = { deletedAt: null };
    if (session.user.role !== "ADMIN") {
      baseProject.userId = session.user.id;
    }
    if (Object.keys(dateWhere).length) baseProject.createdAt = dateWhere;
    if (clientId) baseProject.clientId = clientId;
    if (status) baseProject.status = status;

    let payload: any = {};

    if (type === "project") {
      const projects = await db.project.findMany({
        where: baseProject,
        include: { client: { select: { companyName: true } } },
        orderBy: { createdAt: "desc" },
      });
      payload = {
        type: "project",
        rows: projects.map((p) => ({
          code: p.code,
          name: p.name,
          client: p.client.companyName,
          status: p.status,
          priority: p.priority,
          value: Number(p.totalValue),
          progress: p.progress,
          startDate: p.startDate,
          target: p.targetCompletionDate,
        })),
      };
    } else if (type === "payment") {
      const payments = await db.payment.findMany({
        where: {
          ...(session.user.role !== "ADMIN" ? { project: { userId: session.user.id } } : {}),
          ...(Object.keys(dateWhere).length ? { dueDate: dateWhere } : {}),
          ...(clientId ? { clientId } : {}),
          ...(projectId ? { projectId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          project: { select: { name: true, code: true } },
          client: { select: { companyName: true } },
        },
        orderBy: { dueDate: "asc" },
      });
      payload = {
        type: "payment",
        rows: payments.map((pay) => ({
          termin: pay.terminNumber,
          project: pay.project.name,
          client: pay.client.companyName,
          amount: Number(pay.amount),
          amountPaid: Number(pay.amountPaid),
          dueDate: pay.dueDate,
          paidDate: pay.paidDate,
          status: pay.status,
          method: pay.paymentMethod,
        })),
      };
    } else if (type === "invoice") {
      const invoices = await db.invoice.findMany({
        where: {
          deletedAt: null,
          ...(session.user.role !== "ADMIN" ? { userId: session.user.id } : {}),
          ...(Object.keys(dateWhere).length ? { invoiceDate: dateWhere } : {}),
          ...(clientId ? { clientId } : {}),
          ...(projectId ? { projectId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          client: { select: { companyName: true } },
          project: { select: { name: true } },
        },
        orderBy: { invoiceDate: "desc" },
      });
      payload = {
        type: "invoice",
        rows: invoices.map((inv) => ({
          number: inv.number,
          client: inv.client.companyName,
          project: inv.project?.name ?? "-",
          date: inv.invoiceDate,
          due: inv.dueDate,
          total: Number(inv.total),
          paid: Number(inv.amountPaid),
          status: inv.status,
        })),
      };
    } else {
      // financial summary
      const [projectAgg, invoiceAgg, overdueInvoices, statusCounts] = await Promise.all([
        db.project.aggregate({
          where: { ...baseProject, status: { not: "CANCELLED" } },
          _sum: { totalValue: true },
          _count: true,
        }),
        db.invoice.aggregate({
          where: {
            deletedAt: null,
            status: { not: "CANCELLED" },
            ...(Object.keys(dateWhere).length ? { invoiceDate: dateWhere } : {}),
            ...(clientId ? { clientId } : {}),
          },
          _sum: { total: true, amountPaid: true },
          _count: true,
        }),
        db.invoice.findMany({
          where: { deletedAt: null, status: "OVERDUE", ...(clientId ? { clientId } : {}) },
          include: { client: { select: { companyName: true } } },
          orderBy: { dueDate: "asc" },
        }),
        db.project.groupBy({ by: ["status"], where: baseProject, _count: true }),
      ]);

      const totalInvoiced = Number(invoiceAgg._sum.total ?? 0);
      const totalPaid = Number(invoiceAgg._sum.amountPaid ?? 0);
      payload = {
        type: "financial",
        summary: {
          totalProjects: projectAgg._count,
          totalProjectValue: Number(projectAgg._sum.totalValue ?? 0),
          totalInvoices: invoiceAgg._count,
          totalInvoiced,
          totalPaid,
          outstanding: Math.max(0, totalInvoiced - totalPaid),
          overdueCount: overdueInvoices.length,
          overdueAmount: overdueInvoices.reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0),
        },
        byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count })),
        overdueInvoices: overdueInvoices.map((i) => ({
          number: i.number,
          client: i.client.companyName,
          due: i.dueDate,
          outstanding: Number(i.total) - Number(i.amountPaid),
        })),
      };
    }

    // CSV export
    if (format === "csv") {
      let csv = "";
      if (payload.type === "financial") {
        csv = toCsv([
          ["Laporan Keuangan MYPro"],
          [],
          ["Total Project", payload.summary.totalProjects],
          ["Total Nilai Project", payload.summary.totalProjectValue],
          ["Total Invoiced", payload.summary.totalInvoiced],
          ["Total Dibayar", payload.summary.totalPaid],
          ["Outstanding", payload.summary.outstanding],
          ["Invoice Overdue", payload.summary.overdueCount],
          ["Nilai Overdue", payload.summary.overdueAmount],
        ]);
      } else if (payload.rows?.length) {
        const headers = Object.keys(payload.rows[0]);
        csv = toCsv([headers, ...payload.rows.map((r: any) => headers.map((h) => r[h]))]);
      }
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="laporan-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return Response.json(payload);
  } catch (err) {
    return handleServerError(err);
  }
}
