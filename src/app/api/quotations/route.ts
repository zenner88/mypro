import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";

function computeTotals(items: any[], discount: number, taxPercent: number) {
  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0),
    0
  );
  const afterDiscount = Math.max(0, subtotal - Number(discount || 0));
  const taxAmount = (afterDiscount * Number(taxPercent || 0)) / 100;
  return {
    subtotal: Math.max(0, subtotal),
    taxAmount,
    total: afterDiscount + taxAmount,
  };
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = { deletedAt: null };

    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }

    if (p.q) {
      where.OR = [{ number: { contains: p.q } }, { subject: { contains: p.q } }];
    }
    if (p.status) where.status = p.status;
    if (p.clientId) where.clientId = p.clientId;

    const [items, total] = await Promise.all([
      db.quotation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: {
          client: { select: { id: true, companyName: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      }),
      db.quotation.count({ where }),
    ]);

    return Response.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.clientId || !body.subject) {
      return Response.json({ error: "Client dan subjek wajib diisi" }, { status: 400 });
    }
    const items: any[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return Response.json({ error: "Minimal satu item quotation" }, { status: 400 });
    }

    const discount = Number(body.discount) || 0;
    const taxPercent = Number(body.taxPercent) || 0;
    const totals = computeTotals(items, discount, taxPercent);

    const quotation = await db.$transaction(async (tx: any) => {
      const number = await nextDocumentNumber("QUO", tx);
      return tx.quotation.create({
        data: {
          number,
          userId: session.user.id,
          clientId: body.clientId,
          projectId: body.projectId || null,
          subject: body.subject,
          quotationDate: body.quotationDate ? new Date(body.quotationDate) : new Date(),
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
          subtotal: totals.subtotal,
          discount,
          taxPercent,
          taxAmount: totals.taxAmount,
          total: totals.total,
          status: body.status || "DRAFT",
          terms: body.terms || null,
          notes: body.notes || null,
          items: {
            create: items.map((it: any, idx: number) => ({
              name: it.name,
              description: it.description || null,
              qty: Number(it.qty) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              discount: Number(it.discount) || 0,
              sortOrder: idx,
            })),
          },
        },
        include: { items: true, client: true },
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "QUOTATION",
      recordId: quotation.id,
      description: `Quotation ${quotation.number} dibuat`,
    });

    return Response.json(quotation, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
