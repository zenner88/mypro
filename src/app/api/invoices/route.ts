import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { getAllSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = { deletedAt: null };

    // Scoping for non-admin users: strictly only their own invoices
    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }

    if (p.q) {
      where.OR = [{ number: { contains: p.q } }, { description: { contains: p.q } }];
    }
    if (p.status) where.status = p.status;
    if (p.clientId) where.clientId = p.clientId;
    if (p.projectId) where.projectId = p.projectId;

    const [items, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { invoiceDate: "desc" },
        skip: p.skip,
        take: p.limit,
        include: {
          client: { select: { id: true, companyName: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      }),
      db.invoice.count({ where }),
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
    if (!body.clientId) return Response.json({ error: "Client wajib diisi" }, { status: 400 });

    // Check freemium invoice limit
    if (session.user.role !== "ADMIN") {
      const maxInvoices = session.user.maxInvoices ?? 3;
      const userInvoiceCount = await db.invoice.count({
        where: { userId: session.user.id, deletedAt: null },
      });
      if (userInvoiceCount >= maxInvoices) {
        return Response.json(
          {
            error: `Batas invoice tercapai (Maksimal ${maxInvoices} invoice untuk paket Free). Silakan hubungi admin untuk upgrade ke paket Pro!`,
            code: "LIMIT_REACHED",
          },
          { status: 403 }
        );
      }
    }

    const settings = await getAllSettings();
    const defaultTax = Number(settings.invoice_default_tax_percent) || 0;
    const termsDays = Number(settings.invoice_default_payment_terms_days) || 7;

    const items: any[] = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : [];

    // From payment/termin: auto-fill description & amount
    let fromPayment: any = null;
    if (body.paymentId) {
      fromPayment = await db.payment.findUnique({
        where: { id: body.paymentId },
        include: { project: true },
      });
      if (!fromPayment) return Response.json({ error: "Payment tidak ditemukan" }, { status: 404 });

      const outstanding = Number(fromPayment.amount) - Number(fromPayment.amountPaid);
      if (outstanding <= 0) {
        return Response.json({ error: "Termin ini sudah lunas" }, { status: 400 });
      }

      // One active invoice per termin — delete the old invoice first to re-issue.
      const activeInvoice = await db.invoice.findFirst({
        where: { paymentId: body.paymentId, deletedAt: null, status: { not: "CANCELLED" } },
        select: { number: true },
      });
      if (activeInvoice) {
        return Response.json(
          { error: `Termin ini sudah memiliki invoice aktif (${activeInvoice.number}). Hapus atau batalkan invoice tersebut terlebih dahulu.` },
          { status: 409 }
        );
      }
    }

    // Default: single item from project value or payment amount
    if (items.length === 0) {
      const amount = fromPayment
        ? Number(fromPayment.amount) - Number(fromPayment.amountPaid)
        : Number(body.amount) || 0;
      const desc = fromPayment
        ? `Termin ${fromPayment.terminNumber} — ${fromPayment.project?.name ?? "Project"}`
        : body.description || "Jasa pengembangan / layanan";
      if (amount > 0 || !fromPayment) {
        items.push({ name: desc, qty: 1, unitPrice: amount });
      }
    }

    const subtotal = items.reduce(
      (s, it) => s + Number(it.qty || 1) * Number(it.unitPrice || 0) - Number(it.discount || 0),
      0
    );
    const discount = Number(body.discount) || 0;
    const taxPercent = body.taxPercent !== undefined ? Number(body.taxPercent) : defaultTax;
    const afterDiscount = Math.max(0, subtotal - discount);
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const total = afterDiscount + taxAmount;

    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : new Date(invoiceDate.getTime() + termsDays * 24 * 60 * 60 * 1000);

    const invoice = await db.$transaction(async (tx: any) => {
      const number = await nextDocumentNumber("INV", tx);
      return tx.invoice.create({
        data: {
          number,
          userId: session.user.id,
          clientId: body.clientId,
          projectId: body.projectId || fromPayment?.projectId || null,
          paymentId: body.paymentId || null,
          invoiceDate,
          dueDate,
          currency: body.currency || "IDR",
          description: body.description || null,
          subtotal: Math.max(0, subtotal),
          discount,
          taxPercent,
          taxAmount,
          total,
          status: body.status || "SENT",
          notes: body.notes ?? settings.invoice_notes,
          paymentInstructions: settings.payment_instructions || null,
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
        include: { items: true },
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "INVOICE",
      recordId: invoice.id,
      description: `Invoice ${invoice.number} dibuat`,
    });

    return Response.json(invoice, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
