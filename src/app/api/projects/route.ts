import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { daysUntil } from "@/lib/format";

const ACTIVE_STATUSES = ["APPROVED", "IN_PROGRESS", "ON_HOLD"];

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = { deletedAt: null };

    // Multi-tenant scoping: regular users see strictly only their own data
    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }

    if (p.q) {
      where.OR = [{ name: { contains: p.q } }, { code: { contains: p.q } }, { description: { contains: p.q } }];
    }
    if (p.status) where.status = p.status;
    if (p.clientId) where.clientId = p.clientId;

    const [items, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: {
          client: { select: { id: true, companyName: true, code: true } },
          _count: { select: { tasks: true, documents: true, invoices: true } },
        },
      }),
      db.project.count({ where }),
    ]);

    // Attach computed payment/overdue info
    const projectIds = items.map((i) => i.id);
    const paymentsAgg = await db.payment.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, status: { not: "CANCELLED" } },
      _sum: { amount: true, amountPaid: true },
    });
    const payMap = new Map(paymentsAgg.map((r) => [r.projectId, r._sum]));

    const enriched = items.map((item) => {
      const sums = payMap.get(item.id);
      const total = Number(item.totalValue);
      const paid = Number(sums?.amountPaid ?? 0);
      const dLeft = daysUntil(item.targetCompletionDate);
      return {
        ...item,
        totalValue: total,
        paid,
        outstanding: Math.max(0, total - paid),
        isOverdue:
          ACTIVE_STATUSES.includes(item.status) && dLeft !== null && dLeft < 0,
        daysLeft: dLeft,
      };
    });

    return Response.json({ items: enriched, total, page: p.page, limit: p.limit });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name || !body.clientId) {
      return Response.json({ error: "Nama project dan client wajib diisi" }, { status: 400 });
    }

    // Limit check for regular non-admin users
    if (session.user.role !== "ADMIN") {
      const userProjectCount = await db.project.count({
        where: { userId: session.user.id, deletedAt: null },
      });
      const maxProjects = session.user.maxProjects ?? 1;
      if (userProjectCount >= maxProjects) {
        return Response.json(
          {
            error: `Batas Free Tier tercapai (Maksimum ${maxProjects} Project). Upgrade ke Plan Pro untuk membuat project tanpa batas!`,
            code: "LIMIT_REACHED",
            limitType: "project",
            current: userProjectCount,
            max: maxProjects,
          },
          { status: 403 }
        );
      }
    }

    const result = await db.$transaction(async (tx: any) => {
      const code = await nextDocumentNumber("PRJ", tx);
      const project = await tx.project.create({
        data: {
          code,
          userId: session.user.id,
          name: body.name.trim(),
          clientId: body.clientId,
          description: body.description || null,
          projectType: body.projectType || null,
          status: body.status || "DRAFT",
          priority: body.priority || "MEDIUM",
          startDate: body.startDate ? new Date(body.startDate) : null,
          targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : null,
          totalValue: Number(body.totalValue) || 0,
          notes: body.notes || null,
        },
      });

      // Optional quick-start: create payment termins in percentages
      if (Array.isArray(body.termins) && body.termins.length > 0) {
        let termin = 1;
        for (const t of body.termins) {
          const percentage = Number(t.percentage) || 0;
          const amount = Number(t.amount) || (percentage / 100) * Number(body.totalValue || 0);
          await tx.payment.create({
            data: {
              projectId: project.id,
              clientId: body.clientId,
              terminNumber: termin++,
              description: t.description || `Termin ${termin - 1}`,
              percentage,
              amount,
              dueDate: t.dueDate ? new Date(t.dueDate) : null,
              status: "PENDING",
            },
          });
        }
      }

      return project;
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "PROJECT",
      recordId: result.id,
      description: `Project dibuat: ${result.name} (${result.code})`,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
