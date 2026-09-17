import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { getAllSettings } from "@/lib/settings";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const quotation = await db.quotation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } }, client: true, project: true },
    });
    if (!quotation) return Response.json({ error: "Quotation tidak ditemukan" }, { status: 404 });

    // Settings untuk template print (nama bisnis, alamat, kontak, dll)
    const settings = await getAllSettings();
    return Response.json({ ...quotation, settings });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await db.quotation.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Quotation tidak ditemukan" }, { status: 404 });

    const data: any = {};
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.clientId !== undefined) data.clientId = body.clientId;
    if (body.quotationDate !== undefined) data.quotationDate = new Date(body.quotationDate);
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.terms !== undefined) data.terms = body.terms;
    if (body.notes !== undefined) data.notes = body.notes;

    let discount = Number(body.discount ?? existing.discount);
    let taxPercent = Number(body.taxPercent ?? existing.taxPercent);
    data.discount = discount;
    data.taxPercent = taxPercent;

    if (body.items !== undefined && Array.isArray(body.items) && body.items.length > 0) {
      const subtotal = body.items.reduce(
        (s: number, it: any) => s + Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0),
        0
      );
      const afterDiscount = Math.max(0, subtotal - discount);
      const taxAmount = (afterDiscount * taxPercent) / 100;
      data.subtotal = Math.max(0, subtotal);
      data.taxAmount = taxAmount;
      data.total = afterDiscount + taxAmount;

      await db.quotationItem.deleteMany({ where: { quotationId: params.id } });
      await db.quotationItem.createMany({
        data: body.items.map((it: any, idx: number) => ({
          quotationId: params.id,
          name: it.name,
          description: it.description || null,
          qty: Number(it.qty) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          sortOrder: idx,
        })),
      });
    }

    let statusChanged: string | null = null;
    if (body.status !== undefined && body.status !== existing.status) {
      data.status = body.status;
      statusChanged = body.status;
    }

    const quotation = await db.quotation.update({ where: { id: params.id }, data });

    await logActivity({
      userId: session.user.id,
      action: statusChanged ? "STATUS_CHANGED" : "UPDATED",
      module: "QUOTATION",
      recordId: quotation.id,
      description: statusChanged
        ? `Status quotation ${quotation.number} -> ${statusChanged}`
        : `Quotation ${quotation.number} diperbarui`,
    });

    return Response.json(quotation);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await db.quotation.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) return Response.json({ error: "Quotation tidak ditemukan" }, { status: 404 });

    await db.quotation.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    await logActivity({
      userId: session.user.id,
      action: "DELETED",
      module: "QUOTATION",
      recordId: params.id,
      description: `Quotation ${existing.number} dihapus`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
