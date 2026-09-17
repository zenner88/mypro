import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { recomputeInvoiceStatus } from "@/lib/finance";
import { getAllSettings } from "@/lib/settings";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const invoice = await db.invoice.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        client: true,
        project: { select: { id: true, name: true, code: true } },
        payment: { select: { id: true, terminNumber: true, description: true } },
      },
    });
    if (!invoice) return Response.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

    const settings = await getAllSettings();
    return Response.json({ ...invoice, settings });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await db.invoice.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

    // Business rule #6: invoice with payments cannot be fully edited/deleted
    if (Number(existing.amountPaid) > 0 && body.items) {
      return Response.json(
        { error: "Invoice yang sudah dibayar tidak dapat mengubah item" },
        { status: 400 }
      );
    }

    const data: any = {};
    if (body.invoiceDate !== undefined) data.invoiceDate = new Date(body.invoiceDate);
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.description !== undefined) data.description = body.description;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined && ["DRAFT", "SENT", "CANCELLED"].includes(body.status)) {
      data.status = body.status;
    }

    if (body.items !== undefined && Array.isArray(body.items) && body.items.length > 0) {
      const subtotal = body.items.reduce(
        (s: number, it: any) => s + Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0),
        0
      );
      const discount = Number(body.discount ?? existing.discount);
      const taxPercent = Number(body.taxPercent ?? existing.taxPercent);
      const afterDiscount = Math.max(0, subtotal - discount);
      const taxAmount = (afterDiscount * taxPercent) / 100;
      data.subtotal = Math.max(0, subtotal);
      data.discount = discount;
      data.taxPercent = taxPercent;
      data.taxAmount = taxAmount;
      data.total = afterDiscount + taxAmount;

      await db.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      await db.invoiceItem.createMany({
        data: body.items.map((it: any, idx: number) => ({
          invoiceId: params.id,
          name: it.name,
          description: it.description || null,
          qty: Number(it.qty) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          sortOrder: idx,
        })),
      });
      await recomputeInvoiceStatus(params.id);
    }

    const invoice = await db.invoice.update({ where: { id: params.id }, data });

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "INVOICE",
      recordId: invoice.id,
      description: `Invoice ${invoice.number} diperbarui`,
    });

    return Response.json(invoice);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await db.invoice.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

    if (Number(existing.amountPaid) > 0) {
      return Response.json(
        { error: "Invoice yang sudah memiliki pembayaran tidak dapat dihapus" },
        { status: 400 }
      );
    }

    // Soft-delete + release the linked payment/termin so the same termin
    // can be invoiced again without hitting a unique constraint.
    await db.invoice.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), paymentId: null },
    });

    await logActivity({
      userId: session.user.id,
      action: "DELETED",
      module: "INVOICE",
      recordId: params.id,
      description: `Invoice ${existing.number} dihapus`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
