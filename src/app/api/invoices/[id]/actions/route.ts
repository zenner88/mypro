import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { recomputeInvoiceStatus, syncPaymentFromInvoice } from "@/lib/finance";
import { formatIDR } from "@/lib/format";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const invoice = await db.invoice.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) return Response.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

    switch (body.action) {
      case "duplicate": {
        const duplicated = await db.$transaction(async (tx: any) => {
          const number = await nextDocumentNumber("INV", tx);
          return tx.invoice.create({
            data: {
              number,
              clientId: invoice.clientId,
              projectId: invoice.projectId,
              invoiceDate: new Date(),
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              currency: invoice.currency,
              description: invoice.description,
              subtotal: invoice.subtotal,
              discount: invoice.discount,
              taxPercent: invoice.taxPercent,
              taxAmount: invoice.taxAmount,
              total: invoice.total,
              status: "DRAFT",
              notes: invoice.notes,
              paymentInstructions: invoice.paymentInstructions,
              items: {
                create: invoice.items.map((it, idx) => ({
                  name: it.name,
                  description: it.description,
                  qty: it.qty,
                  unitPrice: it.unitPrice,
                  discount: it.discount,
                  sortOrder: idx,
                })),
              },
            },
          });
        });

        await logActivity({
          userId: session.user.id,
          action: "CREATED",
          module: "INVOICE",
          recordId: duplicated.id,
          description: `Invoice ${duplicated.number} diduplikasi dari ${invoice.number}`,
        });

        return Response.json(duplicated, { status: 201 });
      }

      case "mark-paid": {
        if (Number(invoice.amountPaid) >= Number(invoice.total) && Number(invoice.total) > 0) {
          return Response.json({ error: "Invoice sudah lunas" }, { status: 400 });
        }

        const remaining = Number(invoice.total) - Number(invoice.amountPaid);

        const result = await db.$transaction(async (tx: any) => {
          const updated = await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: Number(invoice.total), status: "PAID" },
          });

          let receipt: any = null;
          if (invoice.paymentId) {
            const receiptNumber = await nextDocumentNumber("REC", tx);
            receipt = await tx.receipt.create({
              data: {
                number: receiptNumber,
                paymentId: invoice.paymentId,
                amount: remaining,
                paymentMethod: body.paymentMethod || "BANK_TRANSFER",
                paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
                notes: `Pembayaran penuh invoice ${invoice.number}`,
              },
            });
          }

          return { updated, receipt };
        });

        if (invoice.paymentId) await syncPaymentFromInvoice(invoice.paymentId);

        await logActivity({
          userId: session.user.id,
          action: "PAID",
          module: "INVOICE",
          recordId: invoice.id,
          description: result.receipt
            ? `Invoice ${invoice.number} lunas (${formatIDR(remaining)}). Receipt ${result.receipt.number} dibatu.`
            : `Invoice ${invoice.number} lunas (${formatIDR(remaining)}).`,
        });

        return Response.json({ ok: true, receipt: result.receipt });
      }

      case "mark-sent": {
        if (invoice.status === "DRAFT") {
          await db.invoice.update({ where: { id: invoice.id }, data: { status: "SENT" } });
          await logActivity({
            userId: session.user.id,
            action: "UPDATED",
            module: "INVOICE",
            recordId: invoice.id,
            description: `Invoice ${invoice.number} ditandai terkirim`,
          });
        }
        return Response.json({ ok: true });
      }

      case "cancel": {
        await db.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
        await logActivity({
          userId: session.user.id,
          action: "STATUS_CHANGED",
          module: "INVOICE",
          recordId: invoice.id,
          description: `Invoice ${invoice.number} dibatalkan`,
        });
        return Response.json({ ok: true });
      }

      case "record-payment": {
        // Partial payment recording
        const amount = Number(body.amount) || 0;
        if (amount <= 0) return Response.json({ error: "Jumlah pembayaran tidak valid" }, { status: 400 });

        const newPaid = Number(invoice.amountPaid) + amount;
        if (newPaid > Number(invoice.total)) {
          return Response.json({ error: "Pembayaran melebihi total invoice" }, { status: 400 });
        }

        const result = await db.$transaction(async (tx: any) => {
          const updated = await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: newPaid },
          });

          let receipt: any = null;
          if (invoice.paymentId) {
            const receiptNumber = await nextDocumentNumber("REC", tx);
            receipt = await tx.receipt.create({
              data: {
                number: receiptNumber,
                paymentId: invoice.paymentId,
                amount,
                paymentMethod: body.paymentMethod || "BANK_TRANSFER",
                paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
                notes: `Pembayaran sebagian invoice ${invoice.number}`,
              },
            });
          }

          return { updated, receipt };
        });

        await recomputeInvoiceStatus(invoice.id);
        if (invoice.paymentId) await syncPaymentFromInvoice(invoice.paymentId);

        await logActivity({
          userId: session.user.id,
          action: "PAID",
          module: "INVOICE",
          recordId: invoice.id,
          description: result.receipt
            ? `Pembayaran ${formatIDR(amount)} dicatat untuk ${invoice.number}. Receipt ${result.receipt.number}.`
            : `Pembayaran ${formatIDR(amount)} dicatat untuk ${invoice.number}.`,
        });

        return Response.json({ ok: true, receipt: result.receipt });
      }

      default:
        return Response.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    }
  } catch (err) {
    return handleServerError(err);
  }
}
