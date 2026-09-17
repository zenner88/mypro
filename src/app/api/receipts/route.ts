import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { formatIDR } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = {};
    if (p.q) where.number = { contains: p.q };
    if (p.projectId) where.payment = { projectId: p.projectId };

    const [items, total] = await Promise.all([
      db.receipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: {
          payment: {
            select: {
              id: true,
              terminNumber: true,
              project: { select: { id: true, name: true, code: true } },
              client: { select: { id: true, companyName: true } },
            },
          },
        },
      }),
      db.receipt.count({ where }),
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
    const payment = await db.payment.findUnique({ where: { id: body.paymentId } });
    if (!payment) return Response.json({ error: "Payment tidak ditemukan" }, { status: 404 });

    const amount = Number(body.amount) || Number(payment.amount) - Number(payment.amountPaid);
    if (amount <= 0) return Response.json({ error: "Termin sudah lunas" }, { status: 400 });

    const newPaid = Number(payment.amountPaid) + amount;
    if (newPaid > Number(payment.amount)) {
      return Response.json({ error: "Pembayaran melebihi jumlah termin" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx: any) => {
      const number = await nextDocumentNumber("REC", tx);

      const receipt = await tx.receipt.create({
        data: {
          number,
          paymentId: payment.id,
          amount,
          paymentMethod: body.paymentMethod || "BANK_TRANSFER",
          paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
          notes: body.notes || null,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          amountPaid: newPaid,
          paidDate: newPaid >= Number(payment.amount) ? new Date() : payment.paidDate,
          status:
            newPaid >= Number(payment.amount)
              ? "PAID"
              : "PARTIALLY_PAID",
          paymentMethod: body.paymentMethod || payment.paymentMethod,
          referenceNumber: body.referenceNumber || payment.referenceNumber,
        },
      });

      return receipt;
    });

    await logActivity({
      userId: session.user.id,
      action: "PAID",
      module: "RECEIPT",
      recordId: result.id,
      description: `Receipt ${result.number} dibuat — pembayaran ${formatIDR(amount)} untuk Termin ${payment.terminNumber}`,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
